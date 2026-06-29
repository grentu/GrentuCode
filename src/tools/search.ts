import * as fs from "fs";
import * as path from "path";
import type { Tool, ToolResult, ToolContext } from "./base";

function searchRecursive(dir: string, pattern: RegExp, fileGlob: string | null, maxResults: number): string[] {
  const results: string[] = [];
  const ignoreDirs = new Set(["node_modules", ".git", "dist", ".next", "__pycache__", ".cache"]);

  function walk(currentDir: string) {
    if (results.length >= maxResults) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (fileGlob && !matchesGlob(entry.name, fileGlob)) continue;
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;
            if (pattern.test(lines[i])) {
              results.push(`${path.relative(dir, fullPath)}:${i + 1}:${lines[i].trim().slice(0, 200)}`);
            }
          }
        } catch {
          continue;
        }
      }
    }
  }

  walk(dir);
  return results;
}

function matchesGlob(filename: string, glob: string): boolean {
  if (glob === "*") return true;
  if (glob.startsWith("*.")) {
    return filename.endsWith(glob.slice(1));
  }
  return filename === glob;
}

function searchFiles(dir: string, glob: string, maxResults: number): string[] {
  const results: string[] = [];
  const ignoreDirs = new Set(["node_modules", ".git", "dist", ".next", "__pycache__", ".cache"]);

  function walk(currentDir: string) {
    if (results.length >= maxResults) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (matchesGlob(entry.name, glob)) {
          results.push(path.relative(dir, fullPath));
        }
      }
    }
  }

  walk(dir);
  return results;
}

async function search(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const pattern = params.pattern as string;
  if (!pattern) return { success: false, output: "", error: "Missing required parameter: pattern" };

  const mode = (params.mode as string) ?? "content";
  const fileGlob = (params.file_glob as string) ?? null;
  const maxResults = (params.max_results as number) ?? 50;

  try {
    if (mode === "files") {
      const results = searchFiles(ctx.workingDirectory, pattern, maxResults);
      if (results.length === 0) return { success: true, output: "No files found matching the pattern." };
      return { success: true, output: results.join("\n") };
    }

    const regex = new RegExp(pattern);
    const results = searchRecursive(ctx.workingDirectory, regex, fileGlob, maxResults);
    if (results.length === 0) return { success: true, output: "No matches found." };
    return { success: true, output: results.join("\n") };
  } catch (err) {
    return {
      success: false,
      output: "",
      error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export const searchTool: Tool = {
  schema: {
    name: "search",
    description: "Search files by content (grep-like) or by filename. Use mode='content' to search inside files with a regex pattern, or mode='files' to find files by glob pattern.",
    parameters: {
      type: "object",
      description: "Parameters for search",
      properties: {
        pattern: {
          type: "string",
          description: "For content mode: a regex pattern to search for in file contents. For files mode: a glob pattern like '*.ts' or '*.py'.",
        },
        mode: {
          type: "string",
          description: "Search mode: 'content' (default) to search inside files, 'files' to find files by name.",
          enum: ["content", "files"],
        },
        file_glob: {
          type: "string",
          description: "Optional: only search in files matching this glob (e.g. '*.ts'). Content mode only.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of results to return. Default: 50.",
        },
      },
      required: ["pattern"],
    },
  },
  permission: "auto",
  execute: search,
};
