export type ToolParamType = "string" | "number" | "boolean" | "array" | "object";

export interface ToolParamSchema {
  type: ToolParamType;
  description: string;
  enum?: string[];
  items?: ToolParamSchema;
  properties?: Record<string, ToolParamSchema>;
  required?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: ToolParamSchema;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolContext {
  workingDirectory: string;
  provider: string;
  model: string;
}

export type PermissionLevel = "auto" | "ask" | "deny";

export interface Tool {
  schema: ToolSchema;
  permission: PermissionLevel;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
