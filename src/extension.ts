import * as vscode from 'vscode';

import * as commandRunner from "./command_runner";


// Function called when the extension activates.
// This extension should activate immediately when visual studios opens so it can create the communication directory
// if necessary.
export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating eam-talon extension.');

  // Initialize the command runner. This will create the communication directory if it does not exist.
  await commandRunner.initialize();

  // Define available commands.
  context.subscriptions.push(vscode.commands.registerCommand('eam-talon.runCommand', commandRunner.runCommand));
}

// Function called when the extension is deactivated.
export function deactivate() { }
