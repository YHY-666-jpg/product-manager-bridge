import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { ContextBuilder } from "../context/ContextBuilder";
import { CustomRulesManager } from "../customRules/CustomRulesManager";
import { CodexAdapter } from "../integrations/CodexAdapter";
import { RooAdapter } from "../integrations/RooAdapter";
import { ApiKeyStore } from "../llm/ApiKeyStore";
import { ModelRouter } from "../llm/ModelRouter";
import { ModelRole, ProviderFormat } from "../llm/types";
import { PlanOrchestrator, OrchestrationResult } from "../orchestrator/PlanOrchestrator";
import { toUserMessage } from "../utils/errors";
import { getWorkspaceRoot } from "../utils/workspace";
import { getWebviewHtml } from "./getWebviewHtml";

type Message = { type: string; payload?: Record<string, unknown> };

export class PmBridgeViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private lastRequirement = "";
  private lastResult: OrchestrationResult | null = null;
  private readonly apiKeys: ApiKeyStore;
  private readonly rules = new CustomRulesManager();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.apiKeys = new ApiKeyStore(context.secrets);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.context.extensionUri);
    webviewView.webview.onDidReceiveMessage((message: Message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      switch (message.type) {
        case "loadInitialState":
          await this.postInitialState();
          break;
        case "generatePlan":
          await this.generate(String(message.payload?.requirement ?? ""));
          break;
        case "copyPlan":
          await this.copyPlan();
          break;
        case "savePlan":
          await this.savePlan();
          break;
        case "sendToRoo":
          await this.sendToRoo();
          break;
        case "sendToCodex":
          await this.sendToCodex();
          break;
        case "setApiKey":
          await vscode.commands.executeCommand(message.payload?.role === "validator" ? "pmBridge.setValidatorApiKey" : "pmBridge.setArchitectApiKey");
          await this.postInitialState();
          break;
        case "clearApiKey":
          await this.apiKeys.clearApiKey(message.payload?.role === "validator" ? "validator" : "architect");
          await this.postInitialState();
          break;
        case "testProvider":
          await this.testProvider(message.payload?.role === "validator" ? "validator" : "architect");
          break;
        case "saveProviderSettings":
          await this.saveProviderSettings(message.payload ?? {});
          break;
        case "saveCustomRules":
          await this.rules.saveRules(String(message.payload?.text ?? ""), Boolean(message.payload?.enabled));
          await this.post({ type: "customRulesSaved", payload: await this.rules.readRules() as unknown as Record<string, unknown> });
          break;
        case "resetCustomRules":
          await this.rules.resetRules();
          await this.postInitialState();
          break;
        case "insertDefaultCustomRules":
          await this.post({ type: "customRulesLoaded", payload: { ...(await this.rules.readRules()), text: this.rules.getDefaultTemplate() } });
          break;
      }
    } catch (error) {
      await this.post({ type: "generationError", payload: { message: toUserMessage(error) } });
    }
  }

  private async postInitialState(): Promise<void> {
    await this.post({
      type: "initialState",
      payload: {
        hasArchitectApiKey: await this.apiKeys.hasApiKey("architect"),
        hasValidatorApiKey: await this.apiKeys.hasApiKey("validator"),
        architectSettings: this.readProviderSettings("architect"),
        validatorSettings: this.readProviderSettings("validator"),
        customRules: await this.rules.readRules()
      }
    });
  }

  private async generate(requirement: string): Promise<void> {
    if (!requirement.trim()) {
      throw new Error("Requirement is required.");
    }
    const hasArchitectKey = await this.apiKeys.hasApiKey("architect");
    const hasValidatorKey = await this.apiKeys.hasApiKey("validator");
    if (!hasArchitectKey || !hasValidatorKey) {
      const missing = [
        hasArchitectKey ? "" : "Architect API Key",
        hasValidatorKey ? "" : "Validator API Key"
      ].filter(Boolean).join(" and ");
      throw new Error(`Missing ${missing}. Save API keys first, then click Test.`);
    }
    this.lastRequirement = requirement;
    await this.post({
      type: "generationStarted",
      payload: {
        phase: "collecting_context",
        title: "Collecting Context",
        message: "Reading workspace context before planning."
      }
    });
    const context = await new ContextBuilder().build(requirement);
    await this.post({ type: "contextPreview", payload: new ContextBuilder().summarize(context) as Record<string, unknown> });
    await this.post({
      type: "generationProgress",
      payload: {
        phase: "context_ready",
        title: "Context Ready",
        message: "Context collected. Starting planner pipeline."
      }
    });
    this.lastResult = await new PlanOrchestrator(new ModelRouter(this.apiKeys)).generateValidatedPlan(requirement, {
      onProgress: async (progress) => {
        await this.post({ type: "generationProgress", payload: progress as unknown as Record<string, unknown> });
      }
    });
    await this.post({ type: "generationResult", payload: this.lastResult as unknown as Record<string, unknown> });
  }

  private async copyPlan(): Promise<void> {
    if (!this.lastResult) {
      throw new Error("No plan has been generated.");
    }
    await vscode.env.clipboard.writeText(this.lastResult.plan?.roo_message || JSON.stringify(this.lastResult, null, 2));
  }

  private async savePlan(): Promise<void> {
    if (!this.lastResult) {
      throw new Error("No plan has been generated.");
    }
    const root = getWorkspaceRoot();
    if (!root) {
      throw new Error("Open a workspace before saving a plan.");
    }
    const dir = path.join(root, ".pmbridge");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "last-plan.json"), JSON.stringify({ timestamp: new Date().toISOString(), userRequirement: this.lastRequirement, ...this.lastResult }, null, 2), "utf8");
  }

  private async sendToRoo(): Promise<void> {
    if (!this.lastResult?.plan || !this.lastResult.validation) {
      throw new Error("No validated plan is available.");
    }
    const answer = await vscode.window.showWarningMessage("Send this validated plan to Roo Code?", { modal: true }, "Send");
    if (answer !== "Send") {
      return;
    }
    const result = await new RooAdapter().send(this.lastResult.plan, this.lastResult.validation);
    await this.post({ type: "generationProgress", payload: result });
  }

  private async sendToCodex(): Promise<void> {
    if (!this.lastResult?.plan || !this.lastResult.validation) {
      throw new Error("No validated plan is available.");
    }
    const answer = await vscode.window.showWarningMessage("Send this validated plan to Codex?", { modal: true }, "Send");
    if (answer !== "Send") {
      return;
    }
    const result = await new CodexAdapter().send(this.lastResult.plan, this.lastResult.validation);
    await this.post({
      type: "generationProgress",
      payload: {
        phase: result.ok ? "approved" : "error",
        title: result.ok ? "Sent to Codex" : "Codex Send Failed",
        message: result.message
      }
    });
  }

  private async testProvider(role: ModelRole): Promise<void> {
    const result = await new ModelRouter(this.apiKeys).test(role);
    await this.post({ type: "providerTestResult", payload: { role, ...result } });
  }

  private readProviderSettings(role: ModelRole): Record<string, unknown> {
    const config = vscode.workspace.getConfiguration("pmBridge");
    return {
      format: config.get<ProviderFormat>(`${role}.format`, "openai-compatible"),
      baseUrl: config.get<string>(`${role}.baseUrl`, "https://api.deepseek.com"),
      model: config.get<string>(`${role}.model`, role === "architect" ? "deepseek-v4-pro" : "deepseek-v4-flash")
    };
  }

  private async saveProviderSettings(payload: Record<string, unknown>): Promise<void> {
    const role: ModelRole = payload.role === "validator" ? "validator" : "architect";
    const format = String(payload.format ?? "openai-compatible");
    if (format !== "openai-compatible" && format !== "anthropic-compatible") {
      throw new Error("Invalid API provider.");
    }
    const baseUrl = String(payload.baseUrl ?? "").trim();
    const model = String(payload.model ?? "").trim();
    if (!baseUrl) {
      throw new Error("Base URL is required.");
    }
    try {
      new URL(baseUrl);
    } catch {
      throw new Error("Base URL must be a valid URL.");
    }
    if (!model) {
      throw new Error("Model is required.");
    }

    const target = vscode.workspace.workspaceFolders?.length ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    const config = vscode.workspace.getConfiguration("pmBridge");
    await config.update(`${role}.format`, format, target);
    await config.update(`${role}.baseUrl`, baseUrl, target);
    await config.update(`${role}.model`, model, target);
    await config.update(`${role}.providerName`, baseUrl.includes("deepseek") ? "DeepSeek" : "Custom", target);

    const apiKey = String(payload.apiKey ?? "").trim();
    if (apiKey) {
      await this.apiKeys.setApiKey(role, apiKey);
    }
    await this.post({ type: "providerSettingsSaved", payload: { role, message: `${role} provider settings saved.` } });
  }

  private async post(message: { type: string; payload: Record<string, unknown> }): Promise<void> {
    await this.view?.webview.postMessage(message);
  }
}
