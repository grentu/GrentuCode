import { GoogleGenerativeAI, type Content, SchemaType } from "@google/generative-ai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams, ToolCall } from "./base";
import type { ToolSchema } from "../tools/base";

function toGoogleMessages(messages: ChatMessageLLM[]): { systemInstruction?: string; contents: Content[] } {
  const systemMessage = messages.find((m) => m.role === "system");
  const contents: Content[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      contents.push({
        role: "function",
        parts: [{ functionResponse: { name: m.name ?? "tool", response: { result: m.content } } }],
      });
      continue;
    }

    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const parts: Content["parts"] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls) {
        parts.push({
          functionCall: {
            name: tc.name,
            args: JSON.parse(tc.arguments || "{}"),
          },
        });
      }
      contents.push({ role: "model", parts });
      continue;
    }

    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  return {
    ...(systemMessage && { systemInstruction: systemMessage.content }),
    contents,
  };
}

function toGoogleTools(tools?: ToolSchema[]) {
  if (!tools || tools.length === 0) return undefined;
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: t.parameters.properties ?? {},
        required: t.parameters.required ?? [],
      },
    })),
  }] as unknown as [{ functionDeclarations: unknown[] }];
}

export class GoogleProvider implements LLMProvider {
  name = "google";
  models = ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-1.5-flash"];

  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
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
      const { systemInstruction, contents } = toGoogleMessages(messages);
      const googleTools = toGoogleTools(tools);

      const modelInstance = client.getGenerativeModel({
        model,
        ...(systemInstruction && { systemInstruction }),
        generationConfig: {
          ...(params?.temperature !== undefined && { temperature: params.temperature }),
          ...(params?.maxTokens !== undefined && { maxOutputTokens: params.maxTokens }),
        },
        ...(googleTools && { tools: googleTools as never }),
      });

      const result = await modelInstance.generateContentStream({ contents });

      let fullText = "";
      const toolCalls: ToolCall[] = [];

      for await (const chunk of result.stream) {
        if (callbacks.signal?.aborted) break;

        const candidates = chunk.candidates;
        if (!candidates || candidates.length === 0) continue;

        for (const candidate of candidates) {
          if (!candidate.content?.parts) continue;
          for (const part of candidate.content.parts) {
            if (part.text) {
              fullText += part.text;
              callbacks.onToken(part.text);
            }
            if (part.functionCall) {
              toolCalls.push({
                id: `call_${toolCalls.length + 1}`,
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args ?? {}),
              });
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
