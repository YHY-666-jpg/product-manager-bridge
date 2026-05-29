export type ProviderFormat = "openai-compatible" | "anthropic-compatible";
export type ModelRole = "architect" | "validator";

export interface ModelProviderConfig {
  role: ModelRole;
  providerName: string;
  format: ProviderFormat;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
  apiKeySecretKey: string;
  customHeaders?: Record<string, string>;
  requestTimeoutMs: number;
  maxRetries: number;
}

export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  jsonMode: boolean;
}

export interface LlmResponse {
  text: string;
  raw: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface LlmProvider {
  generateJson(request: LlmRequest): Promise<LlmResponse>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}
