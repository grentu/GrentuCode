import OpenAI from "openai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams } from "./base";

export class LocalProvider implements LLMProvider {
  name = "local";
  models = ["llama3.1", "qwen2.5", "deepseek-r1", "custom"];

  private client: OpenAI | null = null;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? "http://localhost:11434/v1";
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: "local",
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
  ): Promise<void> {
    try {
      const client = this.getClient();
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        ...(params?.temperature !== undefined && { temperature: params.temperature }),
        ...(params?.maxTokens !== undefined && { max_tokens: params.maxTokens }),
      }, { signal: callbacks.signal });

      let fullText = "";
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          fullText += token;
          callbacks.onToken(token);
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
