import OpenAI from "openai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams } from "./base";

export class CustomProvider implements LLMProvider {
  name: string;
  models: string[];

  private client: OpenAI | null = null;
  private apiKey: string;
  private baseUrl: string;

  constructor(name: string, apiKey: string, baseUrl: string, models: string[]) {
    this.name = name;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.models = models;
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
