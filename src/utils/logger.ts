import * as vscode from "vscode";

export class Logger {
  private readonly output = vscode.window.createOutputChannel("Product Manager Bridge");

  info(message: string): void {
    this.output.appendLine(`[info] ${message}`);
  }

  error(message: string): void {
    this.output.appendLine(`[error] ${message}`);
  }
}
