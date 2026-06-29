export interface ChatMessageLLM {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  signal?: AbortSignal;
}

export interface StreamParams {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  name: string;
  models: string[];
  stream(
    messages: ChatMessageLLM[],
    model: string,
    callbacks: StreamCallbacks,
    params?: StreamParams,
  ): Promise<void>;
}
