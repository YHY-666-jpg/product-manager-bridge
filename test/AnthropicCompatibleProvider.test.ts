import { describe, expect, it } from "vitest";
import { AnthropicCompatibleProvider } from "../src/llm/AnthropicCompatibleProvider";
import { ModelProviderConfig } from "../src/llm/types";

const config: ModelProviderConfig = {
  role: "validator",
  providerName: "x",
  format: "anthropic-compatible",
  baseUrl: "https://api.example.com",
  model: "m",
  temperature: 0,
  maxTokens: 100,
  jsonMode: true,
  apiKeySecretKey: "k",
  requestTimeoutMs: 1000,
  maxRetries: 0
};

describe("AnthropicCompatibleProvider", () => {
  it("builds messages request", () => {
    const request = new AnthropicCompatibleProvider(config, "secret").buildRequest({ systemPrompt: "s", userPrompt: "u", temperature: 0, maxTokens: 10, jsonMode: true });
    expect(request.url).toContain("/messages");
    expect((request.init.headers as Record<string, string>)["x-api-key"]).toBe("secret");
    expect((request.init.headers as Record<string, string>)["anthropic-version"]).toBeTruthy();
    expect(request.init.body).toContain("\"system\":\"s\"");
    expect(request.init.body).not.toContain("response_format");
  });
});
