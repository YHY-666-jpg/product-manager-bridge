import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { CustomRulesManager } from "../customRules/CustomRulesManager";
import { CodexAdapter } from "../integrations/CodexAdapter";
import { RooAdapter } from "../integrations/RooAdapter";
import { ApiKeyStore } from "../llm/ApiKeyStore";
import { ModelRouter } from "../llm/ModelRouter";
import { OrchestrationResult, PlanOrchestrator } from "../orchestrator/PlanOrchestrator";
import { getWorkspaceRoot } from "../utils/workspace";

export interface CommandState {
  lastRequirement: string;
  lastResult: OrchestrationResult | null;
}

export function registerCommands(context: vscode.ExtensionContext, state: CommandState): void {
  const apiKeys = new ApiKeyStore(context.secrets);
  const router = new ModelRouter(apiKeys);
  const rules = new CustomRulesManager();

  const safe = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (error) {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("pmBridge.openPanel", safe(async () => {
      await vscode.commands.executeCommand("workbench.view.extension.pmBridge");
    })),
    vscode.commands.registerCommand("pmBridge.generatePlan", safe(async () => {
      const requirement = await vscode.window.showInputBox({ prompt: "Describe the engineering requirement" });
      if (!requirement) {
        return;
      }
      state.lastRequirement = requirement;
      state.lastResult = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Product Manager Bridge generating plan" }, () => new PlanOrchestrator(router).generateValidatedPlan(requirement));
      void vscode.window.showInformationMessage(state.lastResult.userFacingMessage);
    })),
    vscode.commands.registerCommand("pmBridge.copyLastPlan", safe(async () => {
      if (!state.lastResult) {
        throw new Error("No plan has been generated.");
      }
      await vscode.env.clipboard.writeText(JSON.stringify(state.lastResult, null, 2));
      void vscode.window.showInformationMessage("Plan copied.");
    })),
    vscode.commands.registerCommand("pmBridge.saveLastPlan", safe(async () => {
      if (!state.lastResult) {
        throw new Error("No plan has been generated.");
      }
      const root = getWorkspaceRoot();
      if (!root) {
        throw new Error("Open a workspace before saving a plan.");
      }
      const dir = path.join(root, ".pmbridge");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "last-plan.json"), JSON.stringify({ timestamp: new Date().toISOString(), userRequirement: state.lastRequirement, ...state.lastResult }, null, 2), "utf8");
      void vscode.window.showInformationMessage("Plan saved to .pmbridge/last-plan.json.");
    })),
    vscode.commands.registerCommand("pmBridge.sendToRoo", safe(async () => {
      if (!state.lastResult?.plan || !state.lastResult.validation) {
        throw new Error("No validated plan is available.");
      }
      const answer = await vscode.window.showWarningMessage("Send this validated plan to Roo Code?", { modal: true }, "Send");
      if (answer !== "Send") {
        return;
      }
      const result = await new RooAdapter().send(state.lastResult.plan, state.lastResult.validation);
      void vscode.window.showInformationMessage(result.message);
    })),
    vscode.commands.registerCommand("pmBridge.sendToCodex", safe(async () => {
      if (!state.lastResult?.plan || !state.lastResult.validation) {
        throw new Error("No validated plan is available.");
      }
      const answer = await vscode.window.showWarningMessage("Send this validated plan to Codex?", { modal: true }, "Send");
      if (answer !== "Send") {
        return;
      }
      const result = await new CodexAdapter().send(state.lastResult.plan, state.lastResult.validation);
      void vscode.window.showInformationMessage(result.message);
    })),
    vscode.commands.registerCommand("pmBridge.openModelSettings", safe(async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "pmBridge");
    })),
    vscode.commands.registerCommand("pmBridge.setArchitectApiKey", safe(() => setKey(apiKeys, "architect"))),
    vscode.commands.registerCommand("pmBridge.clearArchitectApiKey", safe(async () => { await apiKeys.clearApiKey("architect"); void vscode.window.showInformationMessage("Architect API Key cleared."); })),
    vscode.commands.registerCommand("pmBridge.setValidatorApiKey", safe(() => setKey(apiKeys, "validator"))),
    vscode.commands.registerCommand("pmBridge.clearValidatorApiKey", safe(async () => { await apiKeys.clearApiKey("validator"); void vscode.window.showInformationMessage("Validator API Key cleared."); })),
    vscode.commands.registerCommand("pmBridge.testArchitectProvider", safe(async () => { void vscode.window.showInformationMessage((await router.test("architect")).message); })),
    vscode.commands.registerCommand("pmBridge.testValidatorProvider", safe(async () => { void vscode.window.showInformationMessage((await router.test("validator")).message); })),
    vscode.commands.registerCommand("pmBridge.editCustomRules", safe(async () => { await vscode.commands.executeCommand("workbench.action.openSettings", "pmBridge.customRules"); })),
    vscode.commands.registerCommand("pmBridge.saveCustomRules", safe(async () => { const input = await vscode.window.showInputBox({ prompt: "Custom Rules" }); if (input !== undefined) { await rules.saveRules(input, true); } })),
    vscode.commands.registerCommand("pmBridge.resetCustomRules", safe(async () => { await rules.resetRules(); void vscode.window.showInformationMessage("Custom Rules reset."); }))
  );
}

async function setKey(apiKeys: ApiKeyStore, role: "architect" | "validator"): Promise<void> {
  const value = await vscode.window.showInputBox({ prompt: `Enter ${role} API Key`, password: true, ignoreFocusOut: true });
  if (value) {
    await apiKeys.setApiKey(role, value);
    void vscode.window.showInformationMessage(`${role} API Key saved to SecretStorage.`);
  }
}
