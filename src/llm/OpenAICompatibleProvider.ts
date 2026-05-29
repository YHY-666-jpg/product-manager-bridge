import { LlmProvider, LlmRequest, LlmResponse, ModelProviderConfig } from "./types";
import { fetchWithDiagnostics, throwHttpError } from "./fetchDiagnostics";

export class OpenAICompatibleProvider implements LlmProvider {
  constructor(private readonly config: ModelProviderConfig, private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  buildRequest(request: LlmRequest): { url: string; init: RequestInit } {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt }
      ]
    };
    if (request.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    return {
      url,
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          ...this.config.customHeaders
        },
        body: JSON.stringify(body)
      }
    };
  }

  async generateJson(request: LlmRequest): Promise<LlmResponse> {
    const { url, init } = this.buildRequest(request);
    const response = await fetchWithDiagnostics(this.config, this.fetchImpl, url, init);
    if (!response.ok) {
      await throwHttpError(this.config, url, response);
    }
    const raw = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, number> };
    return {
      text: raw.choices?.[0]?.message?.content ?? "",
      raw,
      usage: {
        inputTokens: raw.usage?.prompt_tokens,
        outputTokens: raw.usage?.completion_tokens,
        totalTokens: raw.usage?.total_tokens
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
