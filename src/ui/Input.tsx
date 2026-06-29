import React, { useState } from "react";
import { Text, Box, useInput } from "ink";

interface InputProps {
  primaryColor: string;
  mutedColor: string;
  disabled: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function Input({ primaryColor, mutedColor, disabled, onSubmit, onCancel }: InputProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (disabled) return;

    if (key.ctrl && input === "c") {
      onCancel();
      return;
    }

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (key.escape) {
      setValue("");
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.shift && input.length > 0) {
      if (input.charCodeAt(0) >= 0x20) {
        setValue((v) => v + input);
      }
    }
  });

  const showValue = disabled ? value + " (processing...)" : value;

  return React.createElement(
    Box,
    { marginTop: 1 },
    React.createElement(Text, { color: primaryColor, bold: true }, "❯ "),
    React.createElement(
      Text,
      { color: disabled ? mutedColor : undefined },
      showValue,
      disabled
        ? null
        : React.createElement(Text, { color: primaryColor }, "▋"),
    ),
  );
}
