import { LlmProvider, LlmRequest, LlmResponse, ModelProviderConfig } from "./types";
import { fetchWithDiagnostics, throwHttpError } from "./fetchDiagnostics";

export class AnthropicCompatibleProvider implements LlmProvider {
  constructor(private readonly config: ModelProviderConfig, private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  buildRequest(request: LlmRequest): { url: string; init: RequestInit } {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/messages`;
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          ...this.config.customHeaders
        },
        body: JSON.stringify({
          model: this.config.model,
          system: request.systemPrompt,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: [{ role: "user", content: request.userPrompt }]
        })
      }
    };
  }

  async generateJson(request: LlmRequest): Promise<LlmResponse> {
    const { url, init } = this.buildRequest(request);
    const response = await fetchWithDiagnostics(this.config, this.fetchImpl, url, init);
    if (!response.ok) {
      await throwHttpError(this.config, url, response);
    }
    const raw = await response.json() as { content?: Array<{ type: string; text?: string }>; usage?: Record<string, number> };
    const text = raw.content?.find((part) => part.type === "text")?.text ?? "";
    return {
      text,
      raw,
      usage: {
        inputTokens: raw.usage?.input_tokens,
        outputTokens: raw.usage?.output_tokens
      }
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.generateJson({ systemPrompt: "Return JSON.", userPrompt: "{\"ok\":true}", temperature: 0, maxTokens: 32, jsonMode: true });
      return { ok: true, message: "Connection OK." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
