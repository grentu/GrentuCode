import React, { useState } from "react";
import { Text, Box, useInput } from "ink";

interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  onAllow: () => void;
  onDeny: () => void;
  primaryColor: string;
  mutedColor: string;
  accentColor: string;
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "(no arguments)";
  return entries.map(([key, value]) => {
    const strValue = typeof value === "string" ? value : JSON.stringify(value);
    const truncated = strValue.length > 100 ? strValue.slice(0, 100) + "..." : strValue;
    return `  ${key}: ${truncated}`;
  }).join("\n");
}

export function PermissionPrompt({
  toolName,
  args,
  onAllow,
  onDeny,
  primaryColor,
  mutedColor,
  accentColor,
}: PermissionPromptProps) {
  const [choice, setChoice] = useState<"allow" | "deny" | null>(null);

  useInput((input, key) => {
    if (input === "y" || input === "Y" || key.return) {
      setChoice("allow");
      onAllow();
      return;
    }
    if (input === "n" || input === "N" || key.escape) {
      setChoice("deny");
      onDeny();
      return;
    }
  });

  if (choice) {
    return React.createElement(
      Box,
      { flexDirection: "column" },
      React.createElement(
        Text,
        { color: choice === "allow" ? primaryColor : "red" },
        choice === "allow" ? "  ✓ Allowed" : "  ✗ Denied",
      ),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0, paddingBottom: 1 },
    React.createElement(
      Box,
      { gap: 1 },
      React.createElement(Text, { color: accentColor, bold: true }, "⚠ Permission required"),
      React.createElement(Text, { color: mutedColor, dimColor: true }, toolName),
    ),
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 0 },
      React.createElement(Text, { dimColor: true }, formatArgs(args)),
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, "Y = allow  N/Esc = deny"),
    ),
  );
}
