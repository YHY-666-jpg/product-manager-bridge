declare const acquireVsCodeApi: () => { postMessage(message: unknown): void };

type Role = "architect" | "validator";
type ProviderFormat = "openai-compatible" | "anthropic-compatible";

interface ProviderSettings {
  format: ProviderFormat;
  baseUrl: string;
  model: string;
}

interface CustomRulesState {
  text: string;
  enabled: boolean;
  maxChars: number;
}

const vscode = acquireVsCodeApi();
const requirement = document.querySelector<HTMLTextAreaElement>("#requirement");
const result = document.querySelector<HTMLElement>("#result");
const contextBox = document.querySelector<HTMLElement>("#context");
const rules = document.querySelector<HTMLTextAreaElement>("#rules");
const rulesEnabled = document.querySelector<HTMLInputElement>("#rulesEnabled");
const rulesCount = document.querySelector<HTMLElement>("#rulesCount");
const send = document.querySelector<HTMLButtonElement>("#send");
const sendCodex = document.querySelector<HTMLButtonElement>("#sendCodex");
const statusEl = document.querySelector<HTMLElement>("#status");
const stageBanner = document.querySelector<HTMLElement>("#stageBanner");
const stageTitle = document.querySelector<HTMLElement>("#stageTitle");
const stageMessage = document.querySelector<HTMLElement>("#stageMessage");

function post(type: string, payload: Record<string, unknown> = {}): void {
  vscode.postMessage({ type, payload });
}

function setJson(element: HTMLElement | null, value: unknown): void {
  if (element) {
    element.textContent = JSON.stringify(value, null, 2);
  }
}

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function setStage(phase: string, title: string, message: string): void {
  if (stageBanner) {
    stageBanner.className = `stage-banner ${phase}`;
  }
  if (stageTitle) {
    stageTitle.textContent = title;
  }
  if (stageMessage) {
    stageMessage.textContent = message;
  }
  setStatus(message);
}

function updateRulesCount(maxChars = 8000): void {
  if (rulesCount && rules) {
    rulesCount.textContent = `${rules.value.length} / ${maxChars}`;
  }
}

function field<T extends HTMLElement>(role: Role, name: string): T | null {
  return document.querySelector<T>(`[data-role="${role}"][data-field="${name}"]`);
}

function setProvider(role: Role, settings: ProviderSettings, hasApiKey: boolean): void {
  const format = field<HTMLSelectElement>(role, "format");
  const baseUrl = field<HTMLInputElement>(role, "baseUrl");
  const model = field<HTMLInputElement>(role, "model");
  const apiKey = field<HTMLInputElement>(role, "apiKey");
  const keyState = document.querySelector<HTMLElement>(`#${role}Key`);
  if (format) {
    format.value = settings.format;
  }
  if (baseUrl) {
    baseUrl.value = settings.baseUrl;
  }
  if (model) {
    model.value = settings.model;
  }
  if (apiKey) {
    apiKey.value = "";
    apiKey.placeholder = hasApiKey ? "........................" : "Paste API key";
  }
  if (keyState) {
    keyState.textContent = `API Key: ${hasApiKey ? "Set" : "Not Set"}`;
  }
}

function collectProvider(role: Role): Record<string, unknown> {
  return {
    role,
    format: field<HTMLSelectElement>(role, "format")?.value ?? "openai-compatible",
    baseUrl: field<HTMLInputElement>(role, "baseUrl")?.value ?? "",
    model: field<HTMLInputElement>(role, "model")?.value ?? "",
    apiKey: field<HTMLInputElement>(role, "apiKey")?.value ?? ""
  };
}

document.querySelector("#generate")?.addEventListener("click", () => post("generatePlan", { requirement: requirement?.value ?? "" }));
document.querySelector("#copy")?.addEventListener("click", () => post("copyPlan"));
document.querySelector("#save")?.addEventListener("click", () => post("savePlan"));
send?.addEventListener("click", () => post("sendToRoo"));
sendCodex?.addEventListener("click", () => post("sendToCodex"));
document.querySelector("#saveRules")?.addEventListener("click", () => post("saveCustomRules", { text: rules?.value ?? "", enabled: Boolean(rulesEnabled?.checked) }));
document.querySelector("#resetRules")?.addEventListener("click", () => post("resetCustomRules"));
document.querySelector("#templateRules")?.addEventListener("click", () => post("insertDefaultCustomRules"));
rules?.addEventListener("input", () => updateRulesCount());

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => post(button.dataset.action ?? "", { role: button.dataset.role }));
});

document.querySelectorAll<HTMLButtonElement>("[data-provider-save]").forEach((button) => {
  button.addEventListener("click", () => post("saveProviderSettings", collectProvider(button.dataset.providerSave as Role)));
});

window.addEventListener("message", (event: MessageEvent<{ type: string; payload: Record<string, unknown> }>) => {
  const { type, payload } = event.data;

  if (type === "initialState") {
    setProvider("architect", payload.architectSettings as ProviderSettings, Boolean(payload.hasArchitectApiKey));
    setProvider("validator", payload.validatorSettings as ProviderSettings, Boolean(payload.hasValidatorApiKey));
    if (!payload.hasArchitectApiKey || !payload.hasValidatorApiKey) {
      setStage("needs_input", "Setup Required", "Set both API keys, then click Test.");
      if (result) {
        result.textContent = "Set Architect and Validator API keys before generating a plan.";
      }
    } else {
      setStage("idle", "Ready", "API keys are set. You can generate a plan.");
    }
    const customRules = payload.customRules as CustomRulesState;
    if (rules) {
      rules.value = customRules.text;
    }
    if (rulesEnabled) {
      rulesEnabled.checked = customRules.enabled;
    }
    updateRulesCount(customRules.maxChars);
  }

  if (type === "contextPreview") {
    setJson(contextBox, payload);
    setStage("context_ready", "Context Ready", "Context collected. Calling Architect and Validator...");
  }

  if (type === "generationStarted") {
    setStage(String(payload.phase ?? "collecting_context"), String(payload.title ?? "Collecting Context"), String(payload.message ?? "Collecting project context..."));
    if (result) {
      result.textContent = "Generating...";
    }
  }

  if (type === "generationResult") {
    setStage(String(payload.status ?? "complete"), "Plan Generated", "Plan generated. Review validation before sending to Roo Code.");
    setJson(result, payload);
    const validation = payload.validation as { safe_to_execute?: boolean } | null;
    if (send) {
      send.disabled = validation?.safe_to_execute !== true;
    }
    if (sendCodex) {
      sendCodex.disabled = validation?.safe_to_execute !== true;
    }
  }

  if (type === "generationError") {
    setStage("error", "Generation Failed", "Generation failed. See Plan Result.");
    setJson(result, payload);
  }

  if (type === "providerSettingsSaved") {
    setStage("idle", "Provider Saved", String(payload.message ?? "Provider settings saved."));
    post("loadInitialState");
  }

  if (type === "generationProgress") {
    setStage(String(payload.phase ?? "working"), String(payload.title ?? "Working"), String(payload.message ?? "Working..."));
  }

  if (type === "providerTestResult") {
    if (typeof payload.message === "string") {
      setStage(Boolean(payload.ok) ? "approved" : "error", Boolean(payload.ok) ? "Provider OK" : "Provider Failed", payload.message);
    }
    setJson(result, payload);
  }

  if (type === "customRulesLoaded") {
    const loaded = payload as unknown as CustomRulesState;
    if (rules) {
      rules.value = loaded.text;
    }
    if (rulesEnabled) {
      rulesEnabled.checked = loaded.enabled;
    }
    updateRulesCount(loaded.maxChars);
  }
});

post("loadInitialState");
