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
function selectLineRangeIncludingLineBreak(lineFrom: number, lineTo?: number) {
  const effectiveLineTo = lineTo || lineFrom;
  console.log(`Selecting lines including line break: ${lineFrom} to ${effectiveLineTo}`);

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

  console.log(`Selected lines including line break: ${lineFrom} to ${effectiveLineTo}`);
}

// Selects a range of lines. Input line numbers are 1-based.
// If lineTo is not provided, only lineFrom will be selected.
function selectLineRangeForEditing(lineFrom: number, lineTo?: number) {
  const effectiveLineTo = lineTo || lineFrom;
  console.log(`Selecting lines for editing: ${lineFrom} to ${effectiveLineTo}`);

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  // Defer to selection including line break if there is more than one line to select.
  if (effectiveLineTo !== lineFrom) {
    selectLineRangeIncludingLineBreak(lineFrom, effectiveLineTo);
    return;
  }

  // Select one line without including the leading indentation or trailing line break if present.
  // Note: trailing line break will not be present on the last line of the document.
  const document = editor.document;
  const line = document.lineAt(lineFrom - 1);
  const start = new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex);
  const end = line.range.end;
  const selection = new vscode.Selection(start, end);
  editor.selection = selection;
  editor.revealRange(selection);

  console.log(`Selected line for editing: ${lineFrom}`);
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

  // Scroll the editor to the end of the inserted text.
  const insertedEnd = new vscode.Position(cursorPosition.line + effectiveLineTo - lineFrom, 0);
  const selection = new vscode.Selection(insertedEnd, insertedEnd);
  editor.revealRange(selection, vscode.TextEditorRevealType.Default);

  console.log(`Copied lines: ${lineFrom} to ${effectiveLineTo}`);
}

// Selects the given offset range. Input offsets are 0-based.
function setSelection(offsetFrom: number, offsetTo: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const start = editor.document.positionAt(offsetFrom);
  const end = editor.document.positionAt(offsetTo);
  const selection = new vscode.Selection(start, end);
  editor.selection = selection;
  editor.revealRange(selection);
}

// Returns an object containing editor context.
function getEditorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }

  // Get the current selection range as offsets into the file.
  const selection = editor.selection;
  const selectionStartOffset = editor.document.offsetAt(selection.start);
  const selectionEndOffset = editor.document.offsetAt(selection.end);

  // Get text around the selection.
  // Note: Selected text does not count towards the max text length.
  const MaxTextLength = 20000;
  const textStartOffset = Math.max(0, selectionStartOffset - (MaxTextLength / 2));
  const textEndOffset = Math.min(editor.document.getText().length, selectionEndOffset + (MaxTextLength / 2));
  const text = editor.document.getText(new vscode.Range(
    editor.document.positionAt(textStartOffset),
    editor.document.positionAt(textEndOffset)
  ));

  return {
    text,
    selectionStartOffset,
    selectionEndOffset,
    textStartOffset
  };
}

// Get the path to the currently-open file.
function getFilename() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }
  if (editor.document.uri.scheme !== 'file') {
    throw Error("Document URI scheme is not 'file'");
  }
  return editor.document.fileName;
}

// Get the currently selected text.
// By default, copying with an empty selection copies the entire line to the clipboard. This makes it hard to determine
// if the selection actually is empty. This function will return an empty string of nothing is selected.
function getSelectedText() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }
  if (editor.selection.isEmpty) {
    return "";
  }
  return editor.document.getText(editor.selection);
}

// Inserts a new line above the given line number. Input line numbers are 1-based.
function insertNewLineAbove(lineNumber: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }

  // Line numbers are 0-based in the API.
  const position = editor.document.lineAt(lineNumber - 1).range.start;
  editor.edit(builder => {
    builder.insert(position, '\n');
  });
}

// Inserts a new line below the given line number. Input line numbers are 1-based.
function insertNewLineBelow(lineNumber: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }

  // Line numbers are 0-based in the API.
  const position = editor.document.lineAt(lineNumber - 1).range.end;
  editor.edit(builder => {
    builder.insert(position, '\n');
  });
}

// Inserts the given string as a snippet in the active editor.
function insertSnippet(snippetBody: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error("No active text editor");
  }

  const snippet = new vscode.SnippetString(snippetBody);
  editor.insertSnippet(snippet);
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
    vscode.commands.registerCommand('eam-talon.selectLineRangeIncludingLineBreak', selectLineRangeIncludingLineBreak),
    vscode.commands.registerCommand('eam-talon.selectLineRangeForEditing', selectLineRangeForEditing),
    vscode.commands.registerCommand('eam-talon.copyLinesToCursor', copyLinesToCursor),
    vscode.commands.registerCommand('eam-talon.setSelection', setSelection),
    vscode.commands.registerCommand('eam-talon.getEditorContext', getEditorContext),
    vscode.commands.registerCommand('eam-talon.getFilename', getFilename),
    vscode.commands.registerCommand('eam-talon.getSelectedText', getSelectedText),
    vscode.commands.registerCommand('eam-talon.insertNewLineAbove', insertNewLineAbove),
    vscode.commands.registerCommand('eam-talon.insertNewLineBelow', insertNewLineBelow),
    vscode.commands.registerCommand('eam-talon.insertSnippet', insertSnippet),
  );
}

// Function called when the extension is deactivated.
export function deactivate() { }
