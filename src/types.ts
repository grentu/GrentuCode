export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  pending?: boolean;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCallInfo[];
}
