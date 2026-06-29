import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Text, Box, render, useApp, useInput } from "ink";
import { Banner } from "./Banner";
import { Onboarding } from "./Onboarding";
import { Input } from "./Input";
import { Messages } from "./Messages";
import type { ChatMessage } from "./Messages";
import { Spinner } from "./Spinner";
import { getTheme } from "./theme";
import { executeCommand, type CommandContext } from "../commands/registry";
import {
  configExists,
  loadConfig,
  saveConfig,
  type GrentuConfig,
} from "../config";
import { createProvider } from "../providers/registry";
import type { LLMProvider, ChatMessageLLM, StreamParams } from "../providers/base";
import { VERSION } from "../version";

function GrentuApp() {
  const { exit: exitApp } = useApp();
  const [config, setConfig] = useState<GrentuConfig>(() => loadConfig());
  const [needsOnboarding, setNeedsOnboarding] = useState(() => !configExists());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemMsg, setSystemMsg] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const theme = getTheme(config.theme);

  const handleExit = useCallback(() => {
    exitApp();
  }, [exitApp]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingText("");
    setSystemMsg(null);
  }, []);

  const handleSetTheme = useCallback((name: string) => {
    setConfig((c) => {
      const updated = { ...c, theme: name };
      saveConfig(updated);
      return updated;
    });
  }, []);

  const handleSetModel = useCallback((name: string) => {
    setConfig((c) => {
      const updated = { ...c, model: name };
      saveConfig(updated);
      return updated;
    });
  }, []);

  const handleSetProvider = useCallback((name: string, model?: string) => {
    setConfig((c) => {
      let updated = { ...c, provider: name };

      if (model) {
        updated = { ...updated, model };
      } else {
        const providerModels = c.providers?.[name]?.models;
        if (providerModels && providerModels.length > 0) {
          updated = { ...updated, model: providerModels[0] };
        } else {
          const provider = createProvider(name, c);
          if (provider && provider.models.length > 0) {
            const defaultModel = c.providers?.[name]?.defaultModel;
            const targetModel = defaultModel && provider.models.includes(defaultModel)
              ? defaultModel
              : provider.models[0];
            updated = { ...updated, model: targetModel };
          }
        }
      }

      saveConfig(updated);
      return updated;
    });
  }, []);

  const cmdCtx: CommandContext = useMemo(() => ({
    model: config.model,
    provider: config.provider,
    theme: config.theme,
    availableProviders: ["openai", "anthropic", "google", "local"],
    getProviderModels: (name: string) => {
      const providerConfig = config.providers?.[name];
      if (providerConfig?.models && providerConfig.models.length > 0) {
        return providerConfig.models;
      }
      const provider = createProvider(name, config);
      return provider ? provider.models : [];
    },
    setTheme: handleSetTheme,
    setModel: handleSetModel,
    setProvider: handleSetProvider,
    clearMessages: handleClear,
    exit: handleExit,
  }), [config.model, config.provider, config.theme, config.providers, handleSetTheme, handleSetModel, handleSetProvider, handleClear, handleExit]);

  const handleOnboardingComplete = useCallback((themeName: string) => {
    const newConfig = { ...config, theme: themeName };
    saveConfig(newConfig);
    setConfig(newConfig);
    setNeedsOnboarding(false);
  }, [config]);

  const getProviderChain = useCallback((): LLMProvider[] => {
    const chain: LLMProvider[] = [];
    const tried = new Set<string>();

    const primary = createProvider(config.provider, config);
    if (primary) {
      chain.push(primary);
      tried.add(config.provider);
    }

    const fallbackList = config.fallback ?? [];
    for (const name of fallbackList) {
      if (tried.has(name)) continue;
      const provider = createProvider(name, config);
      if (provider) {
        chain.push(provider);
        tried.add(name);
      }
    }

    if (chain.length === 0) {
      const allProviders = ["openai", "anthropic", "google", "local"];
      for (const name of allProviders) {
        if (tried.has(name)) continue;
        const provider = createProvider(name, config);
        if (provider) {
          chain.push(provider);
          tried.add(name);
        }
      }
    }

    return chain;
  }, [config]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const cmdResult = executeCommand(text, cmdCtx);
      if (cmdResult) {
        if (cmdResult.action === "exit") return;
        if (cmdResult.output) {
          setSystemMsg(cmdResult.output);
        }
        return;
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((m) => [...m, userMsg]);
      setSystemMsg(null);
      setIsStreaming(true);
      setStreamingText("");

      const providers = getProviderChain();
      if (providers.length === 0) {
        setSystemMsg(
          "No API key found. Set OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY env var or configure in ~/.grentu/config.json",
        );
        setIsStreaming(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const llmMessages: ChatMessageLLM[] = [
        {
          role: "system",
          content: `You are Grentu Code, an AI coding assistant running in the terminal. Version ${VERSION}. Help the user with coding tasks, answer questions, and provide clear explanations.`,
        },
        ...messagesRef.current
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        { role: "user", content: text },
      ];

      const streamParams: StreamParams = {
        ...(config.temperature !== undefined && { temperature: config.temperature }),
        ...(config.maxTokens !== undefined && { maxTokens: config.maxTokens }),
      };

      let succeeded = false;

      for (let i = 0; i < providers.length && !succeeded; i++) {
        const provider = providers[i];
        const providerModel =
          i === 0 ? config.model : (config.providers?.[provider.name]?.defaultModel ?? provider.models[0]);

        await provider.stream(llmMessages, providerModel, {
          signal: controller.signal,
          onToken: (token) => {
            setStreamingText((prev) => prev + token);
          },
          onComplete: (fullText) => {
            if (controller.signal.aborted) return;
            setMessages((m) => [
              ...m,
              { id: `a-${Date.now()}`, role: "assistant", content: fullText },
            ]);
            setStreamingText("");
            setIsStreaming(false);
            succeeded = true;
          },
          onError: (err) => {
            if (controller.signal.aborted) return;
            if (i < providers.length - 1) {
              setStreamingText("");
              return;
            }
            setSystemMsg(`Error: ${err.message}`);
            setIsStreaming(false);
            setStreamingText("");
          },
        }, streamParams);
      }
    },
    [cmdCtx, config.model, config.temperature, config.maxTokens, config.providers, getProviderChain, isStreaming, messagesRef, abortRef],
  );

  const handleCancel = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
      setStreamingText("");
      setSystemMsg("Cancelled.");
    } else {
      exitApp();
    }
  }, [isStreaming, exitApp, abortRef]);

  useInput((input, key) => {
    if (needsOnboarding) return;
    if (key.ctrl && input === "d") {
      handleExit();
    }
  });

  if (needsOnboarding) {
    return React.createElement(Onboarding, { onComplete: handleOnboardingComplete });
  }

  return React.createElement(
    Box,
    { flexDirection: "column", paddingBottom: 1 },
    React.createElement(Banner, {
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      mutedColor: theme.muted,
    }),
    React.createElement(Messages, {
      messages,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      mutedColor: theme.muted,
    }),
    isStreaming && streamingText
      ? React.createElement(
          Box,
          { flexDirection: "column", marginTop: 1 },
          React.createElement(Text, { color: theme.secondary, bold: true }, "◆ Grentu"),
          React.createElement(Text, { wrap: "wrap" }, streamingText),
        )
      : null,
    isStreaming && !streamingText
      ? React.createElement(Spinner, { color: theme.primary })
      : null,
    systemMsg
      ? React.createElement(
          Box,
          { marginTop: 1 },
          React.createElement(Text, { color: theme.muted, dimColor: true }, systemMsg),
        )
      : null,
    React.createElement(Input, {
      primaryColor: theme.primary,
      mutedColor: theme.muted,
      disabled: isStreaming,
      onSubmit: handleSubmit,
      onCancel: handleCancel,
    }),
  );
}

export function run() {
  render(React.createElement(GrentuApp));
}
