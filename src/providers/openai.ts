import OpenAI from "openai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams, ToolCall } from "./base";
import type { ToolSchema } from "../tools/base";

function toOpenAIMessages(messages: ChatMessageLLM[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      };
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    };
  });
}

function toOpenAITools(tools?: ToolSchema[]) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.parameters.properties ?? {},
        required: t.parameters.required ?? [],
      },
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  name = "openai";
  models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"];

  private client: OpenAI | null = null;
  private apiKey: string;
  private baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
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
      const openaiTools = toOpenAITools(tools);
      const stream = await client.chat.completions.create({
        model,
        messages: toOpenAIMessages(messages),
        stream: true,
        ...(openaiTools && { tools: openaiTools }),
        ...(params?.temperature !== undefined && { temperature: params.temperature }),
        ...(params?.maxTokens !== undefined && { max_tokens: params.maxTokens }),
      }, { signal: callbacks.signal });

      let fullText = "";
      const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullText += delta.content;
          callbacks.onToken(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const existing = toolCallMap.get(idx) ?? { id: "", name: "", arguments: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            toolCallMap.set(idx, existing);
          }
        }
      }

      const toolCalls: ToolCall[] | undefined = toolCallMap.size > 0
        ? Array.from(toolCallMap.values()).filter((tc) => tc.name)
        : undefined;

      callbacks.onComplete(fullText, toolCalls);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
