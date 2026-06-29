import { ALL_TOOLS, getTool } from "./index";
import type { Tool, ToolResult, ToolContext, ToolSchema, PermissionLevel } from "./base";
import type { ChatMessageLLM, ToolCall, LLMProvider } from "../providers/base";

export interface AgentLoopOptions {
  provider: LLMProvider;
  model: string;
  messages: ChatMessageLLM[];
  systemPrompt: string;
  workingDirectory: string;
  maxIterations: number;
  params?: { temperature?: number; maxTokens?: number };
  onToken: (token: string) => void;
  onToolCall: (toolName: string, args: Record<string, unknown>) => void;
  onToolResult: (toolName: string, result: ToolResult) => void;
  onAssistantMessage: (text: string) => void;
  onPermissionRequest?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
  signal?: AbortSignal;
}

export interface AgentLoopResult {
  finalText: string;
  iterations: number;
  toolCalls: number;
  messages: ChatMessageLLM[];
}

function getToolSchemas(tools: Tool[]): ToolSchema[] {
  return tools.map((t) => t.schema);
}

function parseToolArgs(args: string): Record<string, unknown> {
  try {
    return JSON.parse(args || "{}");
  } catch {
    return {};
  }
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const ctx: ToolContext = {
    workingDirectory: opts.workingDirectory,
    provider: opts.provider.name,
    model: opts.model,
  };

  const toolSchemas = getToolSchemas(ALL_TOOLS);
  let currentMessages: ChatMessageLLM[] = [
    { role: "system", content: opts.systemPrompt },
    ...opts.messages,
  ];

  let finalText = "";
  let totalToolCalls = 0;
  let iterations = 0;

  for (iterations = 1; iterations <= opts.maxIterations; iterations++) {
    if (opts.signal?.aborted) break;

    let assistantText = "";
    let assistantToolCalls: ToolCall[] | undefined;

    await opts.provider.stream(currentMessages, opts.model, {
      onToken: (token) => {
        if (opts.signal?.aborted) return;
        assistantText += token;
        opts.onToken(token);
      },
      onComplete: (fullText, toolCalls) => {
        assistantText = fullText;
        assistantToolCalls = toolCalls;
      },
      onError: (err) => {
        throw err;
      },
      signal: opts.signal,
    }, opts.params, toolSchemas);

    if (assistantText) {
      opts.onAssistantMessage(assistantText);
      finalText = assistantText;
    }

    if (!assistantToolCalls || assistantToolCalls.length === 0) {
      currentMessages.push({ role: "assistant", content: assistantText });
      break;
    }

    currentMessages.push({
      role: "assistant",
      content: assistantText,
      toolCalls: assistantToolCalls,
    });

    for (const tc of assistantToolCalls) {
      if (opts.signal?.aborted) break;
      totalToolCalls++;

      const tool = getTool(tc.name);
      if (!tool) {
        const errorMsg = `Unknown tool: ${tc.name}`;
        currentMessages.push({
          role: "tool",
          content: errorMsg,
          toolCallId: tc.id,
          name: tc.name,
        });
        opts.onToolResult(tc.name, { success: false, output: "", error: errorMsg });
        continue;
      }

      const args = parseToolArgs(tc.arguments);
      opts.onToolCall(tc.name, args);

      if (tool.permission === "ask" && opts.onPermissionRequest) {
        const allowed = await opts.onPermissionRequest(tc.name, args);
        if (!allowed) {
          const deniedMsg = `Permission denied for tool: ${tc.name}`;
          currentMessages.push({
            role: "tool",
            content: deniedMsg,
            toolCallId: tc.id,
            name: tc.name,
          });
          opts.onToolResult(tc.name, { success: false, output: "", error: deniedMsg });
          continue;
        }
      }

      let result: ToolResult;
      try {
        result = await tool.execute(args, ctx);
      } catch (err) {
        result = {
          success: false,
          output: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const resultContent = result.success
        ? result.output
        : `Error: ${result.error ?? "Unknown error"}\n${result.output}`;

      currentMessages.push({
        role: "tool",
        content: resultContent,
        toolCallId: tc.id,
        name: tc.name,
      });

      opts.onToolResult(tc.name, result);
    }
  }

  return {
    finalText,
    iterations,
    toolCalls: totalToolCalls,
    messages: currentMessages,
  };
}

export { ALL_TOOLS, getTool };
export type { Tool, ToolResult, ToolContext, ToolSchema, PermissionLevel };
