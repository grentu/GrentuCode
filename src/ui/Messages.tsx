import React from "react";
import { Text, Box } from "ink";
import type { ChatMessage } from "../types";

export type { ChatMessage, ToolCallInfo, MessageRole } from "../types";

interface MessagesProps {
  messages: ChatMessage[];
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  accentColor: string;
}

function formatToolArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries.map(([key, value]) => {
    const strValue = typeof value === "string" ? value : JSON.stringify(value);
    const truncated = strValue.length > 80 ? strValue.slice(0, 80) + "..." : strValue;
    return `${key}=${truncated}`;
  }).join(" ");
}

function truncateOutput(output: string, maxLen: number = 500): string {
  if (output.length <= maxLen) return output;
  return output.slice(0, maxLen) + "\n  ...[truncated]";
}

export function Messages({ messages, primaryColor, secondaryColor, mutedColor, accentColor }: MessagesProps) {
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0 },
    ...messages.map((msg) => {
      if (msg.role === "system") {
        return React.createElement(
          Box,
          { key: msg.id, flexDirection: "column" },
          React.createElement(Text, { color: mutedColor, dimColor: true }, msg.content),
        );
      }

      if (msg.role === "tool") {
        return null;
      }

      const isUser = msg.role === "user";
      const label = isUser ? "You" : "Grentu";
      const labelColor = isUser ? primaryColor : secondaryColor;
      const prefix = isUser ? "❯" : "◆";

      return React.createElement(
        Box,
        { key: msg.id, flexDirection: "column", marginTop: 1 },
        React.createElement(
          Text,
          null,
          React.createElement(Text, { color: labelColor, bold: true }, `${prefix} ${label}`),
        ),
        msg.content
          ? React.createElement(Text, { wrap: "wrap" }, msg.content)
          : null,
        msg.toolCalls && msg.toolCalls.length > 0
          ? React.createElement(
              Box,
              { flexDirection: "column", marginTop: 0 },
              ...msg.toolCalls.map((tc, i) =>
                React.createElement(
                  Box,
                  { key: `${msg.id}-tool-${i}`, flexDirection: "column" },
                  React.createElement(
                    Box,
                    { gap: 1 },
                    React.createElement(Text, { color: accentColor, bold: true }, "  ⚡"),
                    React.createElement(Text, { color: accentColor, bold: true }, tc.name),
                    React.createElement(Text, { color: mutedColor, dimColor: true }, formatToolArgs(tc.args)),
                  ),
                  tc.pending
                    ? React.createElement(Text, { color: mutedColor, dimColor: true }, "  ⟳ running...")
                    : tc.error
                      ? React.createElement(Text, { color: "red", dimColor: true }, `  ✗ ${tc.error}`)
                      : tc.result
                        ? React.createElement(Text, { color: mutedColor, dimColor: true }, `  → ${truncateOutput(tc.result)}`)
                        : null,
                ),
              ),
            )
          : null,
      );
    }),
  );
}
