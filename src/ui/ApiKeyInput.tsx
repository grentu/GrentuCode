import React, { useState } from "react";
import { Text, Box, useInput } from "ink";

interface ApiKeyInputProps {
  providerName: string;
  onComplete: (apiKey: string) => void;
  onCancel: () => void;
}

const BUILTIN_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  local: "Local (Ollama)",
};

export function ApiKeyInput({ providerName, onComplete, onCancel }: ApiKeyInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const label = BUILTIN_LABELS[providerName] ?? providerName;

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (key.return) {
      if (!value.trim()) {
        setError("API key cannot be empty");
        return;
      }
      onComplete(value.trim());
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(null);
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.shift && input.length > 0) {
      setValue((v) => v + input);
      setError(null);
    }
  });

  const masked = "*".repeat(value.length);

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1, paddingBottom: 1 },
    React.createElement(Text, { bold: true }, `Configure ${label}`),
    React.createElement(Text, { dimColor: true }, "Enter your API key:"),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { color: "cyan", bold: true }, "❯ "),
      React.createElement(
        Text,
        null,
        masked,
        React.createElement(Text, { color: "cyan" }, "▋"),
      ),
    ),
    error
      ? React.createElement(Text, { color: "red" }, `  ✗ ${error}`)
      : null,
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, "Enter = confirm  Esc = cancel"),
    ),
  );
}
