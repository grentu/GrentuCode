import { THEME_LIST, THEMES } from "../ui/theme";
import { PROVIDER_NAMES, BUILTIN_PROVIDERS } from "../providers/registry";
import { getProviderModels } from "../providers/registry";
import type { GrentuConfig } from "../config";

export interface CommandContext {
  model: string;
  provider: string;
  theme: string;
  availableProviders: string[];
  getProviderModels: (name: string) => string[];
  setTheme: (name: string) => void;
  setModel: (name: string) => void;
  setProvider: (name: string, model?: string) => void;
  removeProvider: (name: string) => boolean;
  clearMessages: () => void;
  exit: () => void;
}

export interface CommandResult {
  output?: string;
  action?: "clear" | "exit" | "theme-change" | "provider-change" | "provider-add" | "provider-remove";
}

export type CommandHandler = (args: string, ctx: CommandContext) => CommandResult;

export interface CommandDef {
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}

const helpCommand: CommandHandler = (_args, ctx) => {
  const lines = [
    "Available commands:",
    "  /help     Show this help message",
    "  /clear    Clear chat history",
    `  /model    Show or change model (current: ${ctx.model})`,
    `  /provider Show, change, add or remove providers (current: ${ctx.provider})`,
    "            /provider add         Add a custom OpenAI-compatible provider",
    "            /provider remove <name>  Remove a custom provider",
    "            /provider list        List all providers",
    `  /theme    Show or change theme (current: ${ctx.theme})`,
    "  /exit     Exit Grentu Code",
    "",
    "Shortcuts:",
    "  Ctrl+C    Cancel current operation / exit",
    "  Ctrl+D    Exit",
    "  Enter     Send message",
  ];
  return { output: lines.join("\n") };
};

const clearCommand: CommandHandler = (_args, ctx) => {
  ctx.clearMessages();
  return { output: "Chat cleared.", action: "clear" };
};

const modelCommand: CommandHandler = (args, ctx) => {
  if (!args.trim()) {
    const models = ctx.getProviderModels(ctx.provider);
    const list = models.map((m) => `  ${m}`).join("\n");
    return {
      output: `Current model: ${ctx.model}\n\nAvailable models for provider '${ctx.provider}':\n${list}\n\nTo change: /model <name>`,
    };
  }
  ctx.setModel(args.trim());
  return { output: `Model changed to: ${args.trim()}` };
};

const providerCommand: CommandHandler = (args, ctx) => {
  const parts = args.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0 || parts[0] === "list") {
    const list = ctx.availableProviders
      .map((name) => {
        const current = name === ctx.provider ? " ← current" : "";
        const tag = BUILTIN_PROVIDERS.has(name) ? "" : " (custom)";
        const models = ctx.getProviderModels(name);
        const modelList = models.length > 0 ? models.join(", ") : "(no models)";
        return `  ${name.padEnd(12)} ${modelList}${tag}${current}`;
      })
      .join("\n");
    return {
      output: `Current provider: ${ctx.provider}\n\nAvailable providers:\n${list}\n\nTo change: /provider <name> [model]\nTo add custom: /provider add\nTo remove: /provider remove <name>`,
    };
  }

  const subcommand = parts[0];

  if (subcommand === "add") {
    return { output: "Starting custom provider setup...", action: "provider-add" };
  }

  if (subcommand === "remove") {
    const name = parts[1];
    if (!name) {
      return { output: "Usage: /provider remove <name>" };
    }
    if (BUILTIN_PROVIDERS.has(name)) {
      return { output: `Cannot remove built-in provider: ${name}` };
    }
    if (!ctx.availableProviders.includes(name)) {
      return { output: `No custom provider named '${name}'. Available: ${ctx.availableProviders.join(", ")}` };
    }
    const removed = ctx.removeProvider(name);
    if (removed) {
      return { output: `Custom provider '${name}' removed.`, action: "provider-remove" };
    }
    return { output: `Failed to remove provider '${name}'.` };
  }

  const name = subcommand;
  if (!ctx.availableProviders.includes(name)) {
    return {
      output: `Unknown provider: ${name}. Available: ${ctx.availableProviders.join(", ")}`,
    };
  }

  const model = parts[1];
  ctx.setProvider(name, model);
  if (model) {
    return {
      output: `Provider changed to: ${name} (model: ${model})`,
      action: "provider-change",
    };
  }
  return {
    output: `Provider changed to: ${name}`,
    action: "provider-change",
  };
};

const themeCommand: CommandHandler = (args, ctx) => {
  if (!args.trim()) {
    const list = THEME_LIST.map(
      (name) => `  ${name.padEnd(20)} ${THEMES[name].name}`,
    ).join("\n");
    return {
      output: `Current theme: ${ctx.theme}\n\nAvailable themes:\n${list}\n\nTo change: /theme <name>`,
    };
  }
  const name = args.trim();
  if (!THEMES[name]) {
    return { output: `Unknown theme: ${name}. Available: ${THEME_LIST.join(", ")}` };
  }
  ctx.setTheme(name);
  return { output: `Theme changed to: ${THEMES[name].name}`, action: "theme-change" };
};

const exitCommand: CommandHandler = (_args, ctx) => {
  ctx.exit();
  return { action: "exit" };
};

export const COMMANDS: Record<string, CommandDef> = {
  help: { name: "help", description: "Show help", usage: "/help", handler: helpCommand },
  clear: { name: "clear", description: "Clear chat", usage: "/clear", handler: clearCommand },
  model: { name: "model", description: "Show/change model", usage: "/model [name]", handler: modelCommand },
  provider: { name: "provider", description: "Show/change/add/remove provider", usage: "/provider [add|remove <name>|list|<name> [model]]", handler: providerCommand },
  theme: { name: "theme", description: "Show/change theme", usage: "/theme [name]", handler: themeCommand },
  exit: { name: "exit", description: "Exit Grentu", usage: "/exit", handler: exitCommand },
};

export const COMMAND_ALIASES: Record<string, string> = {
  quit: "exit",
  h: "help",
  cls: "clear",
  p: "provider",
};

export function parseCommand(input: string): { command: string; args: string } | null {
  if (!input.startsWith("/")) return null;
  const trimmed = input.slice(1).trim();
  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);
  return { command: cmd, args };
}

export function executeCommand(
  input: string,
  ctx: CommandContext,
): CommandResult | null {
  const parsed = parseCommand(input);
  if (!parsed) return null;

  const cmdName = COMMAND_ALIASES[parsed.command] ?? parsed.command;
  const def = COMMANDS[cmdName];

  if (!def) {
    return { output: `Unknown command: /${parsed.command}. Type /help for available commands.` };
  }

  return def.handler(parsed.args, ctx);
}

export function buildCommandContext(
  config: GrentuConfig,
  handlers: {
    setTheme: (name: string) => void;
    setModel: (name: string) => void;
    setProvider: (name: string, model?: string) => void;
    removeProvider: (name: string) => boolean;
    clearMessages: () => void;
    exit: () => void;
  },
): CommandContext {
  return {
    model: config.model,
    provider: config.provider,
    theme: config.theme,
    availableProviders: PROVIDER_NAMES,
    getProviderModels: (name: string) => getProviderModels(name, config),
    setTheme: handlers.setTheme,
    setModel: handlers.setModel,
    setProvider: handlers.setProvider,
    removeProvider: handlers.removeProvider,
    clearMessages: handlers.clearMessages,
    exit: handlers.exit,
  };
}
