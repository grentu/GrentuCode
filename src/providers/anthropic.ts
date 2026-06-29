import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams } from "./base";

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
  ): Promise<void> {
    try {
      const client = this.getClient();

      const systemMessage = messages.find((m) => m.role === "system");
      const chatMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const maxTokens = params?.maxTokens ?? 4096;

      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: chatMessages,
        ...(systemMessage && { system: systemMessage.content }),
        ...(params?.temperature !== undefined && { temperature: params.temperature }),
      });

      let fullText = "";
      let aborted = false;
      for await (const event of stream) {
        if (callbacks.signal?.aborted) {
          aborted = true;
          break;
        }
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const token = event.delta.text;
          fullText += token;
          callbacks.onToken(token);
        }
      }

      if (!aborted) {
        callbacks.onComplete(fullText);
      }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
