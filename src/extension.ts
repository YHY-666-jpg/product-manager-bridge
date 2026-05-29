import * as vscode from "vscode";
import { registerCommands, CommandState } from "./commands/registerCommands";
import { PmBridgeViewProvider } from "./webview/PmBridgeViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const state: CommandState = { lastRequirement: "", lastResult: null };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "pmBridge.mainView",
      new PmBridgeViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
  registerCommands(context, state);
}

export function deactivate(): void {}
