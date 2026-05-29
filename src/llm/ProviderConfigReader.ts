import * as vscode from "vscode";
import { ModelProviderConfig, ModelRole, ProviderFormat } from "./types";

function readFormat(value: string): ProviderFormat {
  if (value === "openai-compatible" || value === "anthropic-compatible") {
    return value;
  }
  throw new Error(`Invalid provider format: ${value}`);
}

function assertUrl(value: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid provider baseUrl: ${value}`);
  }
}

function assertTemperature(value: number): void {
  if (value < 0 || value > 2) {
    throw new Error("Temperature must be between 0 and 2.");
  }
}

export class ProviderConfigReader {
  read(role: ModelRole): ModelProviderConfig {
    const config = vscode.workspace.getConfiguration("pmBridge");
    const prefix = role;
    const baseUrl = config.get<string>(`${prefix}.baseUrl`, "https://api.deepseek.com");
    const temperature = config.get<number>(`${prefix}.temperature`, role === "architect" ? 0.2 : 0);
    assertUrl(baseUrl);
    assertTemperature(temperature);
    return {
      role,
      providerName: config.get<string>(`${prefix}.providerName`, "DeepSeek"),
      format: readFormat(config.get<string>(`${prefix}.format`, "openai-compatible")),
      baseUrl,
      model: config.get<string>(`${prefix}.model`, role === "architect" ? "deepseek-v4-pro" : "deepseek-v4-flash"),
      temperature,
      maxTokens: config.get<number>(`${prefix}.maxTokens`, role === "architect" ? 8192 : 4096),
      jsonMode: config.get<boolean>(`${prefix}.jsonMode`, true),
      apiKeySecretKey: `pmBridge.apiKey.${role}`,
      customHeaders: config.get<Record<string, string>>("provider.customHeaders", {}),
      requestTimeoutMs: config.get<number>("provider.requestTimeoutMs", 120000),
      maxRetries: config.get<number>("provider.maxRetries", 2)
    };
  }
}
