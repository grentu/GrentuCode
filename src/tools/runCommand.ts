import { exec } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult, ToolContext } from "./base";

const execAsync = promisify(exec);

async function runCommand(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const command = params.command as string;
  if (!command) return { success: false, output: "", error: "Missing required parameter: command" };

  const timeout = (params.timeout as number) ?? 30000;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: ctx.workingDirectory,
      timeout: timeout,
      maxBuffer: 1024 * 1024,
    });

    let output = stdout;
    if (stderr) {
      output += output ? `\n[stderr]\n${stderr}` : stderr;
    }
    if (!output) output = "(no output)";

    const truncated = output.length > 50000 ? output.slice(0, 50000) + "\n[output truncated]" : output;
    return { success: true, output: truncated };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    let output = "";
    if (error.stdout) output += error.stdout;
    if (error.stderr) output += (output ? "\n[stderr]\n" : "") + error.stderr;
    if (!output) output = error.message ?? String(err);
    if (error.killed) output += `\n[Command timed out after ${timeout}ms]`;
    return {
      success: false,
      output,
      error: `Command failed: ${error.message ?? String(err)}`,
    };
  }
}

export const runCommandTool: Tool = {
  schema: {
    name: "run_command",
    description: "Execute a shell command and return stdout/stderr. Use for builds, tests, git operations, package managers. Commands run in the working directory.",
    parameters: {
      type: "object",
      description: "Parameters for run_command",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute.",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds. Default: 30000 (30 seconds).",
        },
      },
      required: ["command"],
    },
  },
  permission: "ask",
  execute: runCommand,
};
