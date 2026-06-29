import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GRENTU_DIR = path.join(os.homedir(), ".grentu");
const CONFIG_FILE = path.join(GRENTU_DIR, "config.json");

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
}

export interface GrentuConfig {
  theme: string;
  provider: string;
  model: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };
  providers?: Record<string, ProviderConfig>;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  fallback?: string[];
}

const DEFAULT_CONFIG: GrentuConfig = {
  theme: "neon-forest",
  provider: "openai",
  model: "gpt-4o",
  apiKeys: {},
  providers: {},
  fallback: [],
};

function migrateConfig(parsed: Record<string, unknown>): GrentuConfig {
  const config: GrentuConfig = {
    ...DEFAULT_CONFIG,
    ...parsed,
  } as GrentuConfig;

  if (!config.providers) {
    config.providers = {};
  }

  if (config.apiKeys?.openai && !config.providers.openai) {
    config.providers.openai = {
      apiKey: config.apiKeys.openai,
      ...(config.baseUrl && { baseUrl: config.baseUrl }),
    };
  }

  if (config.apiKeys?.anthropic && !config.providers.anthropic) {
    config.providers.anthropic = {
      apiKey: config.apiKeys.anthropic,
    };
  }

  if (config.apiKeys?.google && !config.providers.google) {
    config.providers.google = {
      apiKey: config.apiKeys.google,
    };
  }

  if (config.baseUrl && !config.providers.local) {
    config.providers.local = {
      baseUrl: config.baseUrl,
    };
  }

  if (!config.fallback) {
    config.fallback = [];
  }

  return config;
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig(): GrentuConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return migrateConfig(parsed);
  } catch (err) {
    console.error(`Grentu: failed to parse config.json — ${err instanceof Error ? err.message : err}. Using defaults.`);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: GrentuConfig): void {
  if (!fs.existsSync(GRENTU_DIR)) {
    fs.mkdirSync(GRENTU_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(CONFIG_FILE, 0o600);
  fs.chmodSync(GRENTU_DIR, 0o700);
}

export function updateConfig(partial: Partial<GrentuConfig>): GrentuConfig {
  const current = loadConfig();
  const updated = { ...current, ...partial };
  saveConfig(updated);
  return updated;
}

export { CONFIG_FILE, GRENTU_DIR };
