import type { Tool } from "./base";
import { readFileTool } from "./readFile";
import { writeFileTool } from "./writeFile";
import { editFileTool } from "./editFile";
import { runCommandTool } from "./runCommand";
import { searchTool } from "./search";

export const ALL_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  runCommandTool,
  searchTool,
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(
  ALL_TOOLS.map((t) => [t.schema.name, t]),
);

export function getTool(name: string): Tool | null {
  return TOOL_MAP[name] ?? null;
}

export function getToolSchemas() {
  return ALL_TOOLS.map((t) => t.schema);
}

export function getAutoApproveTools(): string[] {
  return ALL_TOOLS.filter((t) => t.permission === "auto").map((t) => t.schema.name);
}

export function getAskTools(): string[] {
  return ALL_TOOLS.filter((t) => t.permission === "ask").map((t) => t.schema.name);
}
