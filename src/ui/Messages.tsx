import React from "react";
import { Text, Box } from "ink";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

interface MessagesProps {
  messages: ChatMessage[];
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
}

export function Messages({ messages, primaryColor, secondaryColor, mutedColor }: MessagesProps) {
  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0 },
    ...messages.map((msg) => {
      const isUser = msg.role === "user";
      const isSystem = msg.role === "system";

      if (isSystem) {
        return React.createElement(
          Box,
          { key: msg.id, flexDirection: "column" },
          React.createElement(Text, { color: mutedColor, dimColor: true }, msg.content),
        );
      }

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
        React.createElement(Text, { wrap: "wrap" }, msg.content),
      );
    }),
  );
}
