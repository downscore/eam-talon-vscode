import * as vscode from "vscode";

import { S_IWOTH } from "constants";
import { mkdirSync, lstatSync } from "fs";
import { open, readFile, stat } from "fs/promises";
import { tmpdir, userInfo } from "os";
import { join } from "path";

import { Request } from "./command_request";
import { Response } from "./command_response";

// Returns the path of the folder containing the request and response files.
function getCommunicationDirPath() {
  // On Windows uid < 0 and the tmpdir is user-specific, so we don't bother with a suffix. This same logic is present in
  // the client.
  const info = userInfo();
  const suffix = info.uid >= 0 ? `-${info.uid}` : "";
  return join(tmpdir(), `vscode-command-server${suffix}`);
}

// Returns the path of the request file.
function getRequestPath() {
  return join(getCommunicationDirPath(), "request.json");
}

// Returns the path of the response file.
function getResponsePath() {
  return join(getCommunicationDirPath(), "response.json");
}

// Prepares the command runner for reading and writing the request and response files.
export async function initialize(): Promise<void> {
  // Create the communication directory if it does not exist.
  const communicationDirPath = getCommunicationDirPath();
  console.debug(`Creating communication directory: ${communicationDirPath}`);
  mkdirSync(communicationDirPath, { recursive: true, mode: 0o770 });

  // Ensure the communication directory path leads to a writable directory.
  const stats = lstatSync(communicationDirPath);
  const info = userInfo();
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    stats.mode & S_IWOTH ||
    // On Windows, uid < 0, so we don't worry about it for simplicity
    (info.uid >= 0 && stats.uid !== info.uid)
  ) {
    throw new Error(
      `Invalid communication directory: ${communicationDirPath}`
    );
  }
}

// Reads a command from the request file, executes it, and writes the result to the response file.
// If the request does not ask for the command output, or does not require waiting for the command to finish, the
// response will be written before the command finishes executing.
export async function runCommand() {
  // Make sure the request isn't too old.
  const VSCODE_COMMAND_TIMEOUT_MS = 3000;
  const stats = await stat(getRequestPath());
  if (Math.abs(stats.mtimeMs - new Date().getTime()) > VSCODE_COMMAND_TIMEOUT_MS) {
    throw new Error("Request file is too old");
  }

  // Open the response file with exclusive access to prevent conflicts with other instances of this extension.
  let responseFile = await open(getResponsePath(), "wx");

  // Read the request from file.
  let request: Request;
  try {
    request = JSON.parse(await readFile(getRequestPath(), "utf-8"));
  } catch (err) {
    // Cleanup the response file on error.
    await responseFile.close();
    throw err;
  }

  let response: Response = {
    returnValue: null,
    uuid: request.uuid,
    error: null,
    warnings: []
  };

  // Raise a warning if this editor is not active.
  if (!vscode.window.state.focused) {
    response.warnings.push("This editor is not active");
  }

  try {
    // Execute the command, and wait for it to complete if necessary.
    const commandPromise = vscode.commands.executeCommand(request.commandId, ...request.args);
    if (request.returnCommandOutput) {
      response.returnValue = await commandPromise;
    } else if (request.waitForFinish) {
      await commandPromise;
    }
  } catch (err) {
    // Return the error message in the response.
    response.error = (err as Error).message;
  }

  // Write the response to file. Include a trailing newline to indicate that the response is complete.
  await responseFile.write(`${JSON.stringify(response)}\n`);
  await responseFile.close();
}
