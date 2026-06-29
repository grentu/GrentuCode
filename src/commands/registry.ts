import { THEME_LIST, THEMES } from "../ui/theme";
import { PROVIDER_NAMES } from "../providers/registry";
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
  clearMessages: () => void;
  exit: () => void;
}

export interface CommandResult {
  output?: string;
  action?: "clear" | "exit" | "theme-change" | "provider-change";
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
    `  /provider Show or change provider (current: ${ctx.provider})`,
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

  if (parts.length === 0) {
    const list = ctx.availableProviders
      .map((name) => {
        const current = name === ctx.provider ? " ← current" : "";
        const models = ctx.getProviderModels(name);
        const modelList = models.length > 0 ? models.join(", ") : "(no models)";
        return `  ${name.padEnd(12)} ${modelList}${current}`;
      })
      .join("\n");
    return {
      output: `Current provider: ${ctx.provider}\n\nAvailable providers:\n${list}\n\nTo change: /provider <name> [model]`,
    };
  }

  const name = parts[0];
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
  provider: { name: "provider", description: "Show/change provider", usage: "/provider [name] [model]", handler: providerCommand },
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
    clearMessages: handlers.clearMessages,
    exit: handlers.exit,
  };
}
