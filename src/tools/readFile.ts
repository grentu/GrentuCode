import * as fs from "fs";
import * as path from "path";
import type { Tool, ToolResult, ToolContext } from "./base";

async function readFile(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const filePath = params.path as string;
  if (!filePath) return { success: false, output: "", error: "Missing required parameter: path" };

  const resolved = path.resolve(ctx.workingDirectory, filePath);
  try {
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      return { success: false, output: "", error: `Path is a directory: ${filePath}` };
    }
    const maxSize = 1024 * 1024;
    if (stats.size > maxSize) {
      const content = fs.readFileSync(resolved, "utf-8").slice(0, maxSize);
      return {
        success: true,
        output: `${content}\n\n[File truncated at ${maxSize} bytes. Total size: ${stats.size} bytes]`,
      };
    }
    const content = fs.readFileSync(resolved, "utf-8");
    const lines = content.split("\n");
    const numbered = lines.map((line, i) => `${i + 1}|${line}`).join("\n");
    return { success: true, output: numbered };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const readFileTool: Tool = {
  schema: {
    name: "read_file",
    description: "Read the contents of a file. Returns file content with line numbers. Use for inspecting source code, config files, etc.",
    parameters: {
      type: "object",
      description: "Parameters for read_file",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read. Relative paths are resolved from the working directory.",
        },
      },
      required: ["path"],
    },
  },
  permission: "auto",
  execute: readFile,
};
