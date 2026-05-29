import { AnthropicCompatibleProvider } from "./AnthropicCompatibleProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import { LlmProvider, ModelProviderConfig } from "./types";

export class ProviderFactory {
  create(config: ModelProviderConfig, apiKey: string): LlmProvider {
    return config.format === "anthropic-compatible"
      ? new AnthropicCompatibleProvider(config, apiKey)
      : new OpenAICompatibleProvider(config, apiKey);
  }
}
