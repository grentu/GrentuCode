import { THEME_LIST, THEMES } from "../ui/theme";

export interface CommandContext {
  model: string;
  provider: string;
  theme: string;
  setTheme: (name: string) => void;
  setModel: (name: string) => void;
  clearMessages: () => void;
  exit: () => void;
}

export interface CommandResult {
  output?: string;
  action?: "clear" | "exit" | "theme-change";
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
    return {
      output: `Current model: ${ctx.model}\nTo change: /model <name>`,
    };
  }
  ctx.setModel(args.trim());
  return { output: `Model changed to: ${args.trim()}` };
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
  theme: { name: "theme", description: "Show/change theme", usage: "/theme [name]", handler: themeCommand },
  exit: { name: "exit", description: "Exit Grentu", usage: "/exit", handler: exitCommand },
};

export const COMMAND_ALIASES: Record<string, string> = {
  quit: "exit",
  h: "help",
  cls: "clear",
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
