import React, { useState, useCallback } from "react";
import { Text, Box, useInput } from "ink";
import type { ProviderConfig } from "../config";

export interface ProviderSetupData {
  name: string;
  config: ProviderConfig;
}

interface ProviderSetupProps {
  existingProviders: string[];
  onComplete: (data: ProviderSetupData) => void;
  onCancel: () => void;
}

const BUILTIN_NAMES = new Set(["openai", "anthropic", "google", "local"]);

const STEPS = [
  { label: "Provider name", hint: "e.g. fireworks, deepseek, my-api" },
  { label: "Endpoint (baseURL)", hint: "e.g. https://api.fireworks.ai/v1" },
  { label: "API key", hint: "your secret key" },
  { label: "Models (comma-separated)", hint: "e.g. gpt-4o, gpt-4o-mini" },
] as const;

const TOTAL_STEPS = STEPS.length;

function validateName(value: string, existing: string[]): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Name cannot be empty";
  if (BUILTIN_NAMES.has(trimmed)) return `'${trimmed}' is a built-in provider name`;
  if (existing.includes(trimmed)) return `Provider '${trimmed}' already exists`;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return "Name can only contain letters, numbers, hyphens and underscores";
  return null;
}

function validateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Endpoint cannot be empty";
  if (!/^https?:\/\//.test(trimmed)) return "Endpoint must start with http:// or https://";
  return null;
}

function validateApiKey(value: string): string | null {
  if (!value.trim()) return "API key cannot be empty";
  return null;
}

function validateModels(value: string): string | null {
  const models = value.split(",").map((m) => m.trim()).filter(Boolean);
  if (models.length === 0) return "At least one model is required";
  return null;
}

export function ProviderSetup({ existingProviders, onComplete, onCancel }: ProviderSetupProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<string[]>(["", "", "", ""]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(() => {
    const models = values[3].split(",").map((m) => m.trim()).filter(Boolean);
    onComplete({
      name: values[0].trim(),
      config: {
        apiKey: values[2].trim(),
        baseUrl: values[1].trim(),
        models,
        defaultModel: models[0],
        custom: true,
      },
    });
  }, [values, onComplete]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (confirming) {
      if (key.return || input === "y" || input === "Y") {
        handleConfirm();
        return;
      }
      if (input === "n" || input === "N") {
        setConfirming(false);
        setStep(0);
        setValue(values[0]);
        setError(null);
        return;
      }
      return;
    }

    if (key.return) {
      const currentStep = step;
      let validationError: string | null = null;

      if (currentStep === 0) validationError = validateName(value, existingProviders);
      else if (currentStep === 1) validationError = validateUrl(value);
      else if (currentStep === 2) validationError = validateApiKey(value);
      else if (currentStep === 3) validationError = validateModels(value);

      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const newValues = [...values];
      newValues[currentStep] = value.trim();
      setValues(newValues);

      if (currentStep < TOTAL_STEPS - 1) {
        setStep(currentStep + 1);
        setValue("");
        return;
      }

      setConfirming(true);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(null);
      return;
    }

    if (key.upArrow) {
      if (step > 0) {
        setStep(step - 1);
        setValue(values[step - 1]);
        setError(null);
      }
      return;
    }

    if (key.downArrow) {
      if (step < TOTAL_STEPS - 1) {
        setStep(step + 1);
        setValue(values[step + 1]);
        setError(null);
      }
      return;
    }

    if (input && !key.ctrl && !key.meta && !key.shift && input.length > 0) {
      setValue((v) => v + input);
      setError(null);
    }
  });

  if (confirming) {
    const models = values[3].split(",").map((m) => m.trim()).filter(Boolean);
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Confirm new custom provider:"),
      React.createElement(Text, null, `  Name:     ${values[0]}`),
      React.createElement(Text, null, `  Endpoint: ${values[1]}`),
      React.createElement(Text, null, `  API key:  ${"*".repeat(Math.min(values[2].length, 20))}`),
      React.createElement(Text, null, `  Models:   ${models.join(", ")}`),
      React.createElement(Text, { dimColor: true }, "\nPress Enter to save, N to edit, Esc to cancel"),
    );
  }

  const currentStep = STEPS[step];

  return React.createElement(
    Box,
    { flexDirection: "column", gap: 1, paddingBottom: 1 },
    React.createElement(Text, { bold: true }, "Add Custom Provider"),
    React.createElement(Text, { dimColor: true }, `Step ${step + 1}/${TOTAL_STEPS}: ${currentStep.label}`),
    React.createElement(Text, { dimColor: true }, currentStep.hint),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { color: "cyan", bold: true }, "❯ "),
      React.createElement(
        Text,
        null,
        value,
        React.createElement(Text, { color: "cyan" }, "▋"),
      ),
    ),
    error
      ? React.createElement(Text, { color: "red" }, `  ✗ ${error}`)
      : null,
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, "Enter = next  ↑↓ = navigate  Esc = cancel"),
    ),
    step > 0 || step < TOTAL_STEPS - 1
      ? React.createElement(
          Box,
          { flexDirection: "column" },
          ...values
            .map((v, i) => {
              if (!v || i === step) return null;
              const label = STEPS[i].label;
              return React.createElement(
                Text,
                { key: i, dimColor: true },
                `  ✓ ${label}: ${i === 2 ? "*".repeat(Math.min(v.length, 10)) : v}`,
              );
            })
            .filter(Boolean),
        )
      : null,
  );
}
