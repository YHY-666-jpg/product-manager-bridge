import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "../src/llm/OpenAICompatibleProvider";
import { ModelProviderConfig } from "../src/llm/types";

const config: ModelProviderConfig = {
  role: "architect",
  providerName: "x",
  format: "openai-compatible",
  baseUrl: "https://api.example.com",
  model: "m",
  temperature: 0,
  maxTokens: 100,
  jsonMode: true,
  apiKeySecretKey: "k",
  requestTimeoutMs: 1000,
  maxRetries: 0
};

describe("OpenAICompatibleProvider", () => {
  it("builds chat completions request", () => {
    const request = new OpenAICompatibleProvider(config, "secret").buildRequest({ systemPrompt: "s", userPrompt: "u", temperature: 0, maxTokens: 10, jsonMode: true });
    expect(request.url).toContain("/chat/completions");
    expect((request.init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(request.init.body).toContain("response_format");
    expect(request.init.body).toContain("\"role\":\"system\"");
  });

  it("reports fetch failures with provider and cause details", async () => {
    const error = new TypeError("fetch failed") as Error & { cause?: unknown };
    error.cause = { code: "ENOTFOUND", hostname: "api.example.com", message: "getaddrinfo ENOTFOUND api.example.com" };
    const fetchImpl = (async () => {
      throw error;
    }) as typeof fetch;

    await expect(new OpenAICompatibleProvider(config, "secret", fetchImpl).generateJson({ systemPrompt: "s", userPrompt: "u", temperature: 0, maxTokens: 10, jsonMode: true }))
      .rejects.toThrow("x provider fetch failed before receiving an HTTP response at https://api.example.com/chat/completions. Cause: fetch failed; code=ENOTFOUND");
  });

  it("includes response body details for HTTP errors", async () => {
    const fetchImpl = (async () => new Response("{\"error\":{\"message\":\"bad key\"}}", { status: 401, statusText: "Unauthorized" })) as typeof fetch;

    await expect(new OpenAICompatibleProvider(config, "secret", fetchImpl).generateJson({ systemPrompt: "s", userPrompt: "u", temperature: 0, maxTokens: 10, jsonMode: true }))
      .rejects.toThrow("x provider failed with HTTP 401 Unauthorized at https://api.example.com/chat/completions. Response: {\"error\":{\"message\":\"bad key\"}}");
  });
});
