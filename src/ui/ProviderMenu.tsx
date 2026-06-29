import React, { useState, useMemo } from "react";
import { Text, Box, useInput } from "ink";
import { PROVIDER_NAMES, BUILTIN_PROVIDERS, getCustomProviderNames } from "../providers/registry";
import type { GrentuConfig } from "../config";

type MenuItemType = "provider" | "separator" | "add-custom" | "remove" | "back";

interface MenuItem {
  type: MenuItemType;
  label: string;
  providerName?: string;
  configured: boolean;
}

interface ProviderMenuProps {
  config: GrentuConfig;
  onSelect: (providerName: string) => void;
  onAddCustom: () => void;
  onRemove: () => void;
  onCancel: () => void;
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  accentColor: string;
}

const BUILTIN_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  local: "Local (Ollama)",
};

function isProviderConfigured(name: string, config: GrentuConfig): boolean {
  if (name === "local") {
    return true;
  }
  const pc = config.providers?.[name];
  if (pc?.apiKey) return true;
  const envKey = name === "openai" ? process.env.OPENAI_API_KEY
    : name === "anthropic" ? process.env.ANTHROPIC_API_KEY
    : name === "google" ? process.env.GOOGLE_API_KEY
    : undefined;
  return Boolean(envKey);
}

export function ProviderMenu({
  config,
  onSelect,
  onAddCustom,
  onRemove,
  onCancel,
  primaryColor,
  secondaryColor,
  mutedColor,
  accentColor,
}: ProviderMenuProps) {
  const customNames = getCustomProviderNames(config);

  const items = useMemo<MenuItem[]>(() => {
    const list: MenuItem[] = [];

    for (const name of PROVIDER_NAMES) {
      list.push({
        type: "provider",
        label: BUILTIN_LABELS[name] ?? name,
        providerName: name,
        configured: isProviderConfigured(name, config),
      });
    }

    for (const name of customNames) {
      list.push({
        type: "provider",
        label: name,
        providerName: name,
        configured: true,
      });
    }

    list.push({ type: "separator", label: "", configured: false });
    list.push({ type: "add-custom", label: "+ Add Custom Provider", configured: false });
    list.push({ type: "remove", label: "✕ Remove Provider", configured: false });

    return list;
  }, [customNames, config]);

  const selectableIndices = useMemo(() => {
    return items
      .map((item, i) => (item.type === "separator" ? -1 : i))
      .filter((i) => i >= 0);
  }, [items]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIdx((prev) => {
        const currentPos = selectableIndices.indexOf(prev);
        const newPos = currentPos <= 0 ? selectableIndices.length - 1 : currentPos - 1;
        return selectableIndices[newPos];
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIdx((prev) => {
        const currentPos = selectableIndices.indexOf(prev);
        const newPos = currentPos >= selectableIndices.length - 1 ? 0 : currentPos + 1;
        return selectableIndices[newPos];
      });
      return;
    }

    if (key.return) {
      const item = items[selectedIdx];
      if (!item) return;

      if (item.type === "provider" && item.providerName) {
        onSelect(item.providerName);
      } else if (item.type === "add-custom") {
        onAddCustom();
      } else if (item.type === "remove") {
        onRemove();
      }
      return;
    }
  });

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0, paddingBottom: 1 },
    React.createElement(Text, { bold: true }, "Select Provider"),
    React.createElement(Text, { dimColor: true }, "↑↓ navigate  Enter select  Esc cancel"),
    React.createElement(Text, null, ""),
    ...items.map((item, i) => {
      if (item.type === "separator") {
        return React.createElement(
          Box,
          { key: `sep-${i}` },
          React.createElement(Text, { color: mutedColor, dimColor: true }, "  ─────────────────────────"),
        );
      }

      const isSelected = i === selectedIdx;
      const cursor = isSelected ? "❯ " : "  ";

      if (item.type === "add-custom") {
        return React.createElement(
          Box,
          { key: "add-custom", gap: 1 },
          React.createElement(Text, { color: primaryColor, bold: isSelected }, cursor),
          React.createElement(
            Text,
            { color: isSelected ? primaryColor : mutedColor, bold: isSelected },
            item.label,
          ),
        );
      }

      if (item.type === "remove") {
        const hasCustom = customNames.length > 0;
        return React.createElement(
          Box,
          { key: "remove", gap: 1 },
          React.createElement(Text, { color: isSelected ? primaryColor : mutedColor, bold: isSelected }, cursor),
          React.createElement(
            Text,
            { color: isSelected ? primaryColor : mutedColor, bold: isSelected },
            hasCustom ? item.label : `${item.label} (none)`,
          ),
        );
      }

      const isActive = item.providerName === config.provider;
      const notConfiguredTag = !item.configured ? " (not configured)" : "";
      const activeTag = isActive ? " ←" : "";
      const isCustom = item.providerName ? !BUILTIN_PROVIDERS.has(item.providerName) : false;
      const customTag = isCustom ? " (custom)" : "";

      const nameColor = isActive
        ? primaryColor
        : item.configured
          ? (isCustom ? secondaryColor : "white")
          : mutedColor;

      return React.createElement(
        Box,
        { key: `item-${i}`, gap: 1 },
        React.createElement(Text, { color: primaryColor, bold: isSelected }, cursor),
        React.createElement(
          Text,
          { color: nameColor, bold: isSelected || isActive },
          item.label,
        ),
        React.createElement(
          Text,
          { color: mutedColor, dimColor: true },
          `${customTag}${notConfiguredTag}`,
        ),
        isActive
          ? React.createElement(Text, { color: accentColor, bold: true }, activeTag)
          : null,
      );
    }),
  );
}
