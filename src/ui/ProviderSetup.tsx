import React, { useState, useCallback, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import { scanCustomModels } from "../providers/registry";
import type { ProviderConfig } from "../config";

export interface ProviderSetupData {
  name: string;
  config: ProviderConfig;
}

interface ProviderSetupProps {
  existingProviders: string[];
  onComplete: (data: ProviderSetupData) => void;
  onCancel: () => void;
  primaryColor: string;
  secondaryColor: string;
  mutedColor: string;
  accentColor: string;
}

const BUILTIN_NAMES = new Set(["openai", "anthropic", "google", "local"]);

const STEPS = [
  { label: "Provider name", hint: "e.g. fireworks, deepseek, my-api" },
  { label: "Endpoint (baseURL)", hint: "e.g. https://api.fireworks.ai/v1" },
  { label: "API key", hint: "your secret key" },
] as const;

const TOTAL_STEPS = STEPS.length;

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

export function ProviderSetup({
  existingProviders,
  onComplete,
  onCancel,
  primaryColor,
  accentColor,
}: ProviderSetupProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<string[]>(["", "", ""]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [manualModels, setManualModels] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [scanning]);

  const doScan = useCallback(async (endpoint: string, apiKey: string) => {
    setScanning(true);
    setScanError(null);
    try {
      const found = await scanCustomModels(endpoint, apiKey);
      if (found.length === 0) {
        setScanError("No models found at this endpoint");
        setManualMode(true);
      } else {
        setModels(found);
        setSelectedModel(0);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
      setManualMode(true);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && !scanning && models.length === 0 && !manualMode && !scanError) {
      doScan(values[1].trim(), values[2].trim());
    }
  }, [step, scanning, models, manualMode, scanError, doScan, values]);

  const handleConfirm = useCallback(() => {
    const finalModels = manualMode
      ? manualModels.split(",").map((m) => m.trim()).filter(Boolean)
      : models;
    if (finalModels.length === 0) return;
    onComplete({
      name: values[0].trim(),
      config: {
        apiKey: values[2].trim(),
        baseUrl: values[1].trim(),
        models: finalModels,
        defaultModel: manualMode ? finalModels[0] : models[selectedModel],
        custom: true,
      },
    });
  }, [values, models, selectedModel, manualMode, manualModels, onComplete]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (scanning) return;

    if (manualMode && step === 3) {
      if (key.return) {
        const parsed = manualModels.split(",").map((m) => m.trim()).filter(Boolean);
        if (parsed.length === 0) {
          setError("At least one model is required");
          return;
        }
        setError(null);
        setConfirming(true);
        return;
      }
      if (key.backspace || key.delete) {
        setManualModels((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.shift && input.length > 0) {
        setManualModels((v) => v + input);
        setError(null);
      }
      return;
    }

    if (step === 3 && models.length > 0 && !confirming) {
      if (key.upArrow) {
        setSelectedModel((s) => (s - 1 + models.length) % models.length);
        return;
      }
      if (key.downArrow) {
        setSelectedModel((s) => (s + 1) % models.length);
        return;
      }
      if (key.return) {
        setConfirming(true);
        return;
      }
      if (input === "r" || input === "R") {
        setModels([]);
        setManualMode(false);
        setScanError(null);
        doScan(values[1].trim(), values[2].trim());
        return;
      }
      if (input === "m" || input === "M") {
        setManualMode(true);
        return;
      }
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

    if (scanError && step === 3) {
      if (input === "r" || input === "R") {
        setScanError(null);
        setManualMode(false);
        doScan(values[1].trim(), values[2].trim());
        return;
      }
      if (input === "m" || input === "M") {
        setManualMode(true);
        setScanError(null);
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

      setStep(3);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(null);
      return;
    }

    if (key.upArrow) {
      if (step > 0 && step < 3) {
        setStep(step - 1);
        setValue(values[step - 1]);
        setError(null);
      }
      return;
    }

    if (key.downArrow) {
      if (step < TOTAL_STEPS - 1) {
        setStep(step + 1);
        setValue(values[step + 1] ?? "");
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
    const finalModels = manualMode
      ? manualModels.split(",").map((m) => m.trim()).filter(Boolean)
      : models;
    const defaultModel = manualMode ? finalModels[0] : models[selectedModel];
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Confirm new custom provider:"),
      React.createElement(Text, null, `  Name:     ${values[0]}`),
      React.createElement(Text, null, `  Endpoint: ${values[1]}`),
      React.createElement(Text, null, `  API key:  ${"*".repeat(Math.min(values[2].length, 20))}`),
      React.createElement(Text, null, `  Models:   ${finalModels.length} available`),
      React.createElement(Text, { color: primaryColor, bold: true }, `  Default:  ${defaultModel}`),
      React.createElement(Text, { dimColor: true }, "\nPress Enter to save, N to edit, Esc to cancel"),
    );
  }

  if (step === 3 && scanning) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Scanning models..."),
      React.createElement(
        Box,
        { gap: 1 },
        React.createElement(Text, { color: primaryColor, bold: true }, SPINNER_FRAMES[spinnerFrame]),
        React.createElement(Text, { dimColor: true }, `Querying ${values[1]}/v1/models`),
      ),
      React.createElement(Text, { dimColor: true }, "Esc = cancel"),
    );
  }

  if (step === 3 && scanError && !manualMode) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true, color: "red" }, "Scan failed"),
      React.createElement(Text, { color: "red", dimColor: true }, `  ${scanError}`),
      React.createElement(Text, { dimColor: true }, "\nR = retry scan  M = enter models manually  Esc = cancel"),
    );
  }

  if (step === 3 && manualMode) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 1, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Enter models manually"),
      React.createElement(Text, { dimColor: true }, "Comma-separated, e.g. gpt-4o, gpt-4o-mini"),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Text, { color: primaryColor, bold: true }, "❯ "),
        React.createElement(
          Text,
          null,
          manualModels,
          React.createElement(Text, { color: primaryColor }, "▋"),
        ),
      ),
      error
        ? React.createElement(Text, { color: "red" }, `  ✗ ${error}`)
        : null,
      React.createElement(Text, { dimColor: true }, "Enter = confirm  Esc = cancel"),
    );
  }

  if (step === 3 && models.length > 0) {
    return React.createElement(
      Box,
      { flexDirection: "column", gap: 0, paddingBottom: 1 },
      React.createElement(Text, { bold: true }, "Select default model"),
      React.createElement(Text, { dimColor: true }, `Found ${models.length} models  ↑↓ navigate  Enter confirm  R rescan  M manual`),
      React.createElement(Text, null, ""),
      ...models.map((model, i) => {
        const isSelected = i === selectedModel;
        const cursor = isSelected ? "❯ " : "  ";
        return React.createElement(
          Box,
          { key: model, gap: 1 },
          React.createElement(Text, { color: accentColor, bold: isSelected }, cursor),
          React.createElement(
            Text,
            { color: isSelected ? primaryColor : "white", bold: isSelected },
            model,
          ),
        );
      }),
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
      React.createElement(Text, { color: primaryColor, bold: true }, "❯ "),
      React.createElement(
        Text,
        null,
        step === 2 ? "*".repeat(value.length) : value,
        React.createElement(Text, { color: primaryColor }, "▋"),
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
              if (!v || i === step || i >= TOTAL_STEPS) return null;
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
