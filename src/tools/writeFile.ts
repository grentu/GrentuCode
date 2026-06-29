import * as fs from "fs";
import * as path from "path";
import type { Tool, ToolResult, ToolContext } from "./base";

async function writeFile(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const filePath = params.path as string;
  const content = params.content as string;
  if (!filePath) return { success: false, output: "", error: "Missing required parameter: path" };
  if (content === undefined || content === null) return { success: false, output: "", error: "Missing required parameter: content" };

  const resolved = path.resolve(ctx.workingDirectory, filePath);
  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, "utf-8");
    const lines = content.split("\n").length;
    return { success: true, output: `File written: ${filePath} (${lines} lines, ${content.length} bytes)` };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const writeFileTool: Tool = {
  schema: {
    name: "write_file",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories automatically.",
    parameters: {
      type: "object",
      description: "Parameters for write_file",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write. Relative paths are resolved from the working directory.",
        },
        content: {
          type: "string",
          description: "The full content to write to the file.",
        },
      },
      required: ["path", "content"],
    },
  },
  permission: "ask",
  execute: writeFile,
};
