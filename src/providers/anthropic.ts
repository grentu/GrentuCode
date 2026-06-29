import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams, ToolCall } from "./base";
import type { ToolSchema } from "../tools/base";

function toAnthropicMessages(messages: ChatMessageLLM[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "tool") {
        return {
          role: "user" as const,
          content: [{
            type: "tool_result" as const,
            tool_use_id: m.toolCallId ?? "",
            content: m.content,
          }],
        };
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant" as const,
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({
              type: "tool_use" as const,
              id: tc.id,
              name: tc.name,
              input: JSON.parse(tc.arguments || "{}"),
            })),
          ],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });
}

function toAnthropicTools(tools?: ToolSchema[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: t.parameters.properties ?? {},
      required: t.parameters.required ?? [],
    },
  }));
}

export class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  models = [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-4-20250514",
  ];

  private client: Anthropic | null = null;
  private apiKey: string;
  private baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: this.apiKey,
        ...(this.baseUrl && { baseURL: this.baseUrl }),
      });
    }
    return this.client;
  }

  async stream(
    messages: ChatMessageLLM[],
    model: string,
    callbacks: StreamCallbacks,
    params?: StreamParams,
    tools?: ToolSchema[],
  ): Promise<void> {
    try {
      const client = this.getClient();
      const systemMessage = messages.find((m) => m.role === "system");
      const chatMessages = toAnthropicMessages(messages);
      const anthropicTools = toAnthropicTools(tools);
      const maxTokens = params?.maxTokens ?? 4096;

      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: chatMessages,
        ...(systemMessage && { system: systemMessage.content }),
        ...(anthropicTools && { tools: anthropicTools }),
        ...(params?.temperature !== undefined && { temperature: params.temperature }),
      });

      let fullText = "";
      const toolCalls: ToolCall[] = [];

      for await (const event of stream) {
        if (callbacks.signal?.aborted) break;

        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          toolCalls.push({
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: "",
          });
        }

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            fullText += event.delta.text;
            callbacks.onToken(event.delta.text);
          } else if (event.delta.type === "input_json_delta") {
            const last = toolCalls[toolCalls.length - 1];
            if (last && "partial_json" in event.delta) {
              last.arguments += event.delta.partial_json as string;
            }
          }
        }
      }

      const finalToolCalls = toolCalls.length > 0 ? toolCalls : undefined;
      callbacks.onComplete(fullText, finalToolCalls);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
