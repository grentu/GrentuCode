import type { ToolSchema } from "../tools/base";

export interface ChatMessageLLM {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string, toolCalls?: ToolCall[]) => void;
  onError: (error: Error) => void;
  onToolCall?: (toolCall: ToolCall) => void;
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
    tools?: ToolSchema[],
  ): Promise<void>;
}
