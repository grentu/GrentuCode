import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GRENTU_DIR = path.join(os.homedir(), ".grentu");
const CONFIG_FILE = path.join(GRENTU_DIR, "config.json");

export interface GrentuConfig {
  theme: string;
  provider: string;
  model: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
  };
  baseUrl?: string;
}

const DEFAULT_CONFIG: GrentuConfig = {
  theme: "neon-forest",
  provider: "openai",
  model: "gpt-4o",
  apiKeys: {},
};

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
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: GrentuConfig): void {
  if (!fs.existsSync(GRENTU_DIR)) {
    fs.mkdirSync(GRENTU_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function updateConfig(partial: Partial<GrentuConfig>): GrentuConfig {
  const current = loadConfig();
  const updated = { ...current, ...partial };
  saveConfig(updated);
  return updated;
}

export { CONFIG_FILE, GRENTU_DIR };
