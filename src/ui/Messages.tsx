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
    const truncated = strValue.length > 60 ? strValue.slice(0, 60) + "…" : strValue;
    return `${key}=${truncated}`;
  }).join(" ");
}

function truncateOutput(output: string, maxLen: number = 400): string {
  if (output.length <= maxLen) return output;
  return output.slice(0, maxLen).trim() + " …";
}

export function Messages({ messages, primaryColor, secondaryColor, mutedColor, accentColor }: MessagesProps) {
  const visible = messages.slice(-100);

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0 },
    messages.length > 100
      ? React.createElement(Text, { color: mutedColor, dimColor: true }, `  ▲ ${messages.length - 100} earlier messages hidden`)
      : null,
    ...visible.map((msg) => {
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

      if (isUser) {
        return React.createElement(
          Box,
          { key: msg.id, flexDirection: "column", marginTop: 1 },
          React.createElement(
            Box,
            { gap: 1 },
            React.createElement(Text, { color: primaryColor, bold: true }, "┌─ You"),
          ),
          React.createElement(
            Box,
            { flexDirection: "column" },
            React.createElement(Text, { color: undefined, wrap: "wrap" }, "  " + msg.content),
          ),
        );
      }

      return React.createElement(
        Box,
        { key: msg.id, flexDirection: "column", marginTop: 1 },
        React.createElement(
          Box,
          { gap: 1 },
          React.createElement(Text, { color: secondaryColor, bold: true }, "┌─ Grentu"),
        ),
        msg.content
          ? React.createElement(Text, { wrap: "wrap" }, "  " + msg.content)
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
                    React.createElement(Text, { color: accentColor, bold: true }, "  ├─⚡"),
                    React.createElement(Text, { color: accentColor, bold: true }, tc.name),
                    React.createElement(Text, { color: mutedColor, dimColor: true }, formatToolArgs(tc.args)),
                  ),
                  tc.pending
                    ? React.createElement(Text, { color: mutedColor, dimColor: true }, "  │  ⟳ running…")
                    : tc.error
                      ? React.createElement(Text, { color: "red", dimColor: true }, `  │  ✗ ${tc.error}`)
                      : tc.result
                        ? React.createElement(Text, { color: mutedColor, dimColor: true }, `  │  → ${truncateOutput(tc.result)}`)
                        : null,
                ),
              ),
            )
          : null,
      );
    }),
  );
}
