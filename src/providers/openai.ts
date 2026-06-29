import OpenAI from "openai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider } from "./base";

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
  ): Promise<void> {
    try {
      const client = this.getClient();
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
      });

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
