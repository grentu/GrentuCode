import type { LLMProvider } from "./base";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { LocalProvider } from "./local";
import type { GrentuConfig } from "../config";

export type ProviderName = "openai" | "anthropic" | "google" | "local";

export const PROVIDER_NAMES: ProviderName[] = ["openai", "anthropic", "google", "local"];

export function createProvider(name: string, config: GrentuConfig): LLMProvider | null {
  const providerConfig = config.providers?.[name];

  switch (name) {
    case "openai": {
      const apiKey =
        providerConfig?.apiKey ??
        config.apiKeys?.openai ??
        process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      return new OpenAIProvider(apiKey, providerConfig?.baseUrl ?? config.baseUrl);
    }

    case "anthropic": {
      const apiKey =
        providerConfig?.apiKey ??
        config.apiKeys?.anthropic ??
        process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return null;
      return new AnthropicProvider(apiKey, providerConfig?.baseUrl);
    }

    case "google": {
      const apiKey =
        providerConfig?.apiKey ??
        config.apiKeys?.google ??
        process.env.GOOGLE_API_KEY;
      if (!apiKey) return null;
      return new GoogleProvider(apiKey);
    }

    case "local": {
      return new LocalProvider(providerConfig?.baseUrl);
    }

    default:
      return null;
  }
}

export function getProviderModels(name: string, config: GrentuConfig): string[] {
  const providerConfig = config.providers?.[name];
  if (providerConfig?.models && providerConfig.models.length > 0) {
    return providerConfig.models;
  }

  const provider = createProvider(name, config);
  if (provider) return provider.models;
  return [];
}
