import * as fs from "fs";
import * as path from "path";
import type { Tool, ToolResult, ToolContext } from "./base";

async function editFile(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const filePath = params.path as string;
  const oldString = params.old_string as string;
  const newString = params.new_string as string;
  const replaceAll = params.replace_all as boolean ?? false;

  if (!filePath) return { success: false, output: "", error: "Missing required parameter: path" };
  if (oldString === undefined) return { success: false, output: "", error: "Missing required parameter: old_string" };
  if (newString === undefined) return { success: false, output: "", error: "Missing required parameter: new_string" };

  const resolved = path.resolve(ctx.workingDirectory, filePath);
  try {
    if (!fs.existsSync(resolved)) {
      return { success: false, output: "", error: `File not found: ${filePath}` };
    }
    const content = fs.readFileSync(resolved, "utf-8");

    if (!content.includes(oldString)) {
      return { success: false, output: "", error: `old_string not found in file. Make sure the string matches exactly, including whitespace.` };
    }

    let updated: string;
    if (replaceAll) {
      updated = content.split(oldString).join(newString);
    } else {
      const idx = content.indexOf(oldString);
      updated = content.slice(0, idx) + newString + content.slice(idx + oldString.length);
    }

    fs.writeFileSync(resolved, updated, "utf-8");
    const replacements = replaceAll ? content.split(oldString).length - 1 : 1;
    return { success: true, output: `Edited ${filePath}: ${replacements} replacement(s) made` };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Failed to edit file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const editFileTool: Tool = {
  schema: {
    name: "edit_file",
    description: "Edit a file by replacing old_string with new_string. The old_string must match exactly (including whitespace). Use replace_all for multiple occurrences.",
    parameters: {
      type: "object",
      description: "Parameters for edit_file",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to edit.",
        },
        old_string: {
          type: "string",
          description: "The exact string to find and replace. Must match exactly including whitespace and indentation.",
        },
        new_string: {
          type: "string",
          description: "The replacement string.",
        },
        replace_all: {
          type: "boolean",
          description: "If true, replace all occurrences. If false (default), replace only the first.",
        },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  permission: "ask",
  execute: editFile,
};
