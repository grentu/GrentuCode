import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import type { ChatMessageLLM, StreamCallbacks, LLMProvider, StreamParams } from "./base";

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

  private convertMessages(messages: ChatMessageLLM[]): {
    systemInstruction?: string;
    contents: Content[];
  } {
    const systemMessage = messages.find((m) => m.role === "system");
    const contents: Content[] = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    return {
      ...(systemMessage && { systemInstruction: systemMessage.content }),
      contents,
    };
  }

  async stream(
    messages: ChatMessageLLM[],
    model: string,
    callbacks: StreamCallbacks,
    params?: StreamParams,
  ): Promise<void> {
    try {
      const client = this.getClient();
      const { systemInstruction, contents } = this.convertMessages(messages);

      const modelInstance = client.getGenerativeModel({
        model,
        ...(systemInstruction && { systemInstruction }),
        generationConfig: {
          ...(params?.temperature !== undefined && { temperature: params.temperature }),
          ...(params?.maxTokens !== undefined && { maxOutputTokens: params.maxTokens }),
        },
      });

      const result = await modelInstance.generateContentStream({ contents });

      let fullText = "";
      let aborted = false;
      for await (const chunk of result.stream) {
        if (callbacks.signal?.aborted) {
          aborted = true;
          break;
        }
        const token = chunk.text();
        if (token) {
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
