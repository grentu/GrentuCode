import OpenAI from "openai";
import type { LLMProvider } from "./base";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { LocalProvider } from "./local";
import { CustomProvider } from "./custom";
import type { GrentuConfig } from "../config";

export type ProviderName = "openai" | "anthropic" | "google" | "local";

export const PROVIDER_NAMES: ProviderName[] = ["openai", "anthropic", "google", "local"];

export const BUILTIN_PROVIDERS = new Set<string>(PROVIDER_NAMES);

export function isCustomProvider(name: string): boolean {
  return !BUILTIN_PROVIDERS.has(name);
}

export function getCustomProviderNames(config: GrentuConfig): string[] {
  if (!config.providers) return [];
  return Object.keys(config.providers).filter((name) => isCustomProvider(name));
}

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

    default: {
      if (!isCustomProvider(name)) return null;
      if (!providerConfig) return null;

      const apiKey = providerConfig.apiKey;
      const baseUrl = providerConfig.baseUrl;
      if (!apiKey || !baseUrl) return null;

      const models = providerConfig.models ?? [];
      if (models.length === 0) return null;

      return new CustomProvider(name, apiKey, baseUrl, models);
    }
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

export async function scanCustomModels(
  endpoint: string,
  apiKey: string,
): Promise<string[]> {
  let base = endpoint.trim().replace(/\/+$/, "");
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    base = "https://" + base;
  }

  const endpoints = [
    base,
    base + "/v1",
    base.replace(/\/v1\/?$/, ""),
    base.replace(/\/v1\/?$/, "") + "/v1",
  ];
  const seen = new Set<string>();
  const unique = endpoints.filter((ep) => {
    if (seen.has(ep)) return false;
    seen.add(ep);
    return true;
  });

  let lastError: Error | null = null;

  for (const ep of unique) {
    try {
      const client = new OpenAI({ apiKey, baseURL: ep });
      const response = await client.models.list();
      const models = response.data
        .map((m) => m.id)
        .filter((id): id is string => Boolean(id))
        .sort((a, b) => a.localeCompare(b));
      if (models.length > 0) return models;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastError) throw lastError;
  return [];
}
