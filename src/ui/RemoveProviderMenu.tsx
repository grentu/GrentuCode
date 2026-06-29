import React, { useState } from "react";
import { Text, Box, useInput } from "ink";
import { getCustomProviderNames } from "../providers/registry";
import type { GrentuConfig } from "../config";

interface RemoveProviderMenuProps {
  config: GrentuConfig;
  onRemove: (providerName: string) => void;
  onBack: () => void;
  primaryColor: string;
  mutedColor: string;
  accentColor: string;
}

export function RemoveProviderMenu({
  config,
  onRemove,
  onBack,
  primaryColor,
  mutedColor,
  accentColor,
}: RemoveProviderMenuProps) {
  const customNames = getCustomProviderNames(config);
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onBack();
      return;
    }

    if (customNames.length === 0) return;

    if (key.upArrow) {
      setSelected((s) => (s - 1 + customNames.length) % customNames.length);
      return;
    }

    if (key.downArrow) {
      setSelected((s) => (s + 1) % customNames.length);
      return;
    }

    if (key.return) {
      onRemove(customNames[selected]);
      return;
    }
  });

  if (customNames.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Remove Provider"),
      React.createElement(Text, { color: mutedColor, dimColor: true }, "No custom providers to remove."),
      React.createElement(Text, { dimColor: true }, "Esc = back"),
    );
  }

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0, paddingBottom: 1 },
    React.createElement(Text, { bold: true }, "Remove Custom Provider"),
    React.createElement(Text, { dimColor: true }, "↑↓ navigate  Enter remove  Esc back"),
    React.createElement(Text, null, ""),
    ...customNames.map((name, i) => {
      const isSelected = i === selected;
      const cursor = isSelected ? "❯ " : "  ";
      const isActive = name === config.provider;

      return React.createElement(
        Box,
        { key: name, gap: 1 },
        React.createElement(Text, { color: accentColor, bold: isSelected }, cursor),
        React.createElement(
          Text,
          { color: isSelected ? primaryColor : "white", bold: isSelected },
          name,
        ),
        isActive
          ? React.createElement(Text, { color: mutedColor, dimColor: true }, "(active)")
          : null,
      );
    }),
  );
}
