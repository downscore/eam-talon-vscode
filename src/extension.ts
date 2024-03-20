import * as vscode from 'vscode';

import * as commandRunner from "./command_runner";


// Jumps to the given line. Input line numbers are 1-based.
function jumpToLine(line: number) {
  console.log(`Jumping to line: ${line}`);

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  // Line numbers are 0-based in the API.
  const documentLine = editor.document.lineAt(line - 1);
  if (!documentLine) {
    throw Error(`Invalid line: ${line}`);
  }

  const position = new vscode.Position(
    documentLine.lineNumber,
    documentLine.firstNonWhitespaceCharacterIndex
  );
  const selection = new vscode.Selection(position, position);
  editor.selection = selection;
  editor.revealRange(selection);

  console.log(`Jumped to line: ${line}`);
}

// Selects a range of lines. Input line numbers are 1-based.
// If lineTo is not provided, only lineFrom will be selected.
function selectLineRange(lineFrom: number, lineTo?: number) {
  const effectiveLineTo = lineTo || lineFrom;
  console.log(`Selecting lines: ${lineFrom} to ${effectiveLineTo}`);

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  // Line numbers are 0-based in the API.
  // Select from start of line to start of subsequent line.
  const document = editor.document;
  const start = document.lineAt(lineFrom - 1).range.start;
  const end = effectiveLineTo >= editor.document.lineCount - 1 ?
    document.lineAt(editor.document.lineCount - 1).range.end : document.lineAt(effectiveLineTo).range.start;

  const selection = new vscode.Selection(start, end);
  editor.selection = selection;
  editor.revealRange(selection);

  console.log(`Selected lines: ${lineFrom} to ${effectiveLineTo}`);
}

// Copies the contents of a range of lines to the cursor location. Input line numbers are 1-based.
// If lineTo is not provided, only lineFrom will be copied.
function copyLinesToCursor(lineFrom: number, lineTo?: number) {
  const effectiveLineTo = lineTo || lineFrom;
  console.log(`Copying lines: ${lineFrom} to ${effectiveLineTo}`);

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  // Line numbers are 0-based in the API.
  const document = editor.document;
  const start = document.lineAt(lineFrom - 1).range.start;
  const end = effectiveLineTo >= editor.document.lineCount - 1 ?
    document.lineAt(editor.document.lineCount - 1).range.end : document.lineAt(effectiveLineTo).range.start;

  const text = document.getText(new vscode.Range(start, end));

  // Insert the text at the start of the line the cursor is on.
  const cursorLine = editor.document.lineAt(editor.selection.active.line);
  const cursorPosition = cursorLine.range.start;
  editor.edit(builder => {
    builder.insert(cursorPosition, text);
  });

  console.log(`Copied lines: ${lineFrom} to ${effectiveLineTo}`);
}


// Function called when the extension activates.
// This extension should activate immediately when visual studios opens so it can create the communication directory
// if necessary.
export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating eam-talon extension.');

  // Initialize the command runner. This will create the communication directory if it does not exist.
  await commandRunner.initialize();

  // Define available commands.
  context.subscriptions.push(
    vscode.commands.registerCommand('eam-talon.runCommand', commandRunner.runCommand),
    vscode.commands.registerCommand('eam-talon.jumpToLine', jumpToLine),
    vscode.commands.registerCommand('eam-talon.selectLineRange', selectLineRange),
    vscode.commands.registerCommand('eam-talon.copyLinesToCursor', copyLinesToCursor)
  );
}

// Function called when the extension is deactivated.
export function deactivate() { }
