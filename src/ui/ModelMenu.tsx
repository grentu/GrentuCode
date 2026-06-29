import React, { useState, useMemo } from "react";
import { Text, Box, useInput } from "ink";
import { PROVIDER_NAMES, BUILTIN_PROVIDERS, getCustomProviderNames } from "../providers/registry";
import type { GrentuConfig } from "../config";

interface ModelMenuProps {
  config: GrentuConfig;
  onSelect: (provider: string, model: string) => void;
  onCancel: () => void;
  getProviderModels: (name: string) => string[];
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  accentColor: string;
}

interface ModelItem {
  provider: string;
  model: string;
  isCurrent: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  local: "Local (Ollama)",
};

export function ModelMenu({
  config,
  onSelect,
  onCancel,
  getProviderModels,
  primaryColor,
  secondaryColor,
  mutedColor,
  accentColor,
}: ModelMenuProps) {
  const customNames = getCustomProviderNames(config);

  const items = useMemo<ModelItem[]>(() => {
    const list: ModelItem[] = [];
    const allProviders = [...PROVIDER_NAMES, ...customNames];
    for (const provider of allProviders) {
      const models = getProviderModels(provider);
      for (const model of models) {
        list.push({
          provider,
          model,
          isCurrent: provider === config.provider && model === config.model,
        });
      }
    }
    return list;
  }, [customNames, config.provider, config.model, getProviderModels]);

  const [selectedIdx, setSelectedIdx] = useState(0);

  const providerLabels = useMemo(() => {
    const labels: Record<string, string> = { ...PROVIDER_LABELS };
    for (const name of customNames) {
      labels[name] = name;
    }
    return labels;
  }, [customNames]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIdx((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIdx((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
      return;
    }

    if (key.return) {
      const item = items[selectedIdx];
      if (item) {
        onSelect(item.provider, item.model);
      }
      return;
    }
  });

  if (items.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Select Model"),
      React.createElement(Text, { color: mutedColor, dimColor: true }, "No models available. Configure a provider first with /provider"),
      React.createElement(Text, { dimColor: true }, "Esc = back"),
    );
  }

  let lastProvider = "";

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 0, paddingBottom: 1 },
    React.createElement(Text, { bold: true }, "Select Model"),
    React.createElement(Text, { dimColor: true }, "↑↓ navigate  Enter select  Esc cancel"),
    React.createElement(Text, null, ""),
    ...items.map((item, i) => {
      const isSelected = i === selectedIdx;
      const cursor = isSelected ? "❯ " : "  ";
      const showProviderHeader = item.provider !== lastProvider;
      lastProvider = item.provider;

      const providerLabel = providerLabels[item.provider] ?? item.provider;
      const isCustom = !BUILTIN_PROVIDERS.has(item.provider);
      const providerTag = isCustom ? " (custom)" : "";

      const elements: React.ReactElement[] = [];

      if (showProviderHeader) {
        elements.push(
          React.createElement(
            Text,
            { key: `header-${item.provider}`, color: secondaryColor, bold: true, dimColor: !isSelected },
            `  ${providerLabel}${providerTag}:`,
          ),
        );
      }

      elements.push(
        React.createElement(
          Box,
          { key: `${item.provider}-${item.model}`, gap: 1 },
          React.createElement(Text, { color: primaryColor, bold: isSelected }, cursor),
          React.createElement(
            Text,
            {
              color: item.isCurrent ? accentColor : isSelected ? primaryColor : "white",
              bold: isSelected || item.isCurrent,
            },
            `  ${item.model}`,
          ),
          item.isCurrent
            ? React.createElement(Text, { color: accentColor, bold: true }, " ← current")
            : null,
        ),
      );

      return React.createElement(React.Fragment, { key: `frag-${item.provider}-${item.model}` }, ...elements);
    }),
  );
}
