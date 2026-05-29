import { ApiKeyStore } from "./ApiKeyStore";
import { ProviderConfigReader } from "./ProviderConfigReader";
import { ProviderFactory } from "./ProviderFactory";
import { LlmRequest, LlmResponse, ModelRole } from "./types";

export class ModelRouter {
  constructor(
    private readonly apiKeyStore: ApiKeyStore,
    private readonly configReader = new ProviderConfigReader(),
    private readonly providerFactory = new ProviderFactory()
  ) {}

  async generate(role: ModelRole, request: LlmRequest): Promise<LlmResponse> {
    const apiKey = await this.apiKeyStore.getApiKey(role);
    if (!apiKey) {
      throw new Error(`${role === "architect" ? "Architect" : "Validator"} API Key is not set.`);
    }
    const config = this.configReader.read(role);
    return this.providerFactory.create(config, apiKey).generateJson(request);
  }

  async test(role: ModelRole): Promise<{ ok: boolean; message: string }> {
    const apiKey = await this.apiKeyStore.getApiKey(role);
    if (!apiKey) {
      return { ok: false, message: `${role} API Key is not set.` };
    }
    return this.providerFactory.create(this.configReader.read(role), apiKey).testConnection();
  }
}
