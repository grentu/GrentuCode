import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import { THEME_LIST, THEMES } from "./theme";

interface OnboardingProps {
  onComplete: (themeName: string) => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((s) => (s - 1 + THEME_LIST.length) % THEME_LIST.length);
    } else if (key.downArrow) {
      setSelected((s) => (s + 1) % THEME_LIST.length);
    } else if (key.return) {
      onComplete(THEME_LIST[selected]);
    } else if (input >= "1" && input <= String(THEME_LIST.length)) {
      const idx = parseInt(input, 10) - 1;
      if (idx < THEME_LIST.length) setSelected(idx);
    }
  });

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1 },
    React.createElement(Text, { bold: true }, "Welcome to Grentu Code!"),
    React.createElement(Text, { dimColor: true }, "Choose your color theme (↑/↓ or 1-4, Enter to confirm):"),
    React.createElement(
      Box,
      { flexDirection: "column", gap: 0 },
      ...THEME_LIST.map((name, i) => {
        const theme = THEMES[name];
        const isSelected = i === selected;
        const cursor = isSelected ? "❯ " : "  ";
        const number = `${i + 1}.`;
        return React.createElement(
          Box,
          { key: name, gap: 1 },
          React.createElement(Text, { color: theme.primary }, cursor),
          React.createElement(Text, { color: theme.muted, dimColor: true }, number),
          React.createElement(
            Text,
            { color: isSelected ? theme.primary : theme.text, bold: isSelected },
            theme.name,
          ),
          React.createElement(
            Text,
            { color: theme.secondary },
            "●",
          ),
          React.createElement(
            Text,
            { color: theme.accent },
            "●",
          ),
        );
      }),
    ),
  );
}
