import React, { useState, useCallback } from "react";
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
  updateConfig,
  type GrentuConfig,
} from "../config";
import { OpenAIProvider } from "../providers/openai";
import type { LLMProvider, ChatMessageLLM } from "../providers/base";

const GRENTU_VERSION = "v0.1.0";

function GrentuApp() {
  const { exit: exitApp } = useApp();
  const [config, setConfig] = useState<GrentuConfig>(() => loadConfig());
  const [needsOnboarding, setNeedsOnboarding] = useState(() => !configExists());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemMsg, setSystemMsg] = useState<string | null>(null);

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

  const cmdCtx: CommandContext = {
    model: config.model,
    provider: config.provider,
    theme: config.theme,
    setTheme: handleSetTheme,
    setModel: handleSetModel,
    clearMessages: handleClear,
    exit: handleExit,
  };

  const handleOnboardingComplete = useCallback((themeName: string) => {
    const newConfig = { ...config, theme: themeName };
    saveConfig(newConfig);
    setConfig(newConfig);
    setNeedsOnboarding(false);
  }, [config]);

  const getProvider = useCallback((): LLMProvider | null => {
    const apiKey = config.apiKeys.openai ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      setSystemMsg(
        "No API key found. Set OPENAI_API_KEY env var or configure in ~/.grentu/config.json",
      );
      return null;
    }
    return new OpenAIProvider(apiKey, config.baseUrl);
  }, [config.apiKeys.openai, config.baseUrl]);

  const handleSubmit = useCallback(
    async (text: string) => {
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

      const provider = getProvider();
      if (!provider) {
        setIsStreaming(false);
        return;
      }

      const llmMessages: ChatMessageLLM[] = [
        {
          role: "system",
          content: `You are Grentu Code, an AI coding assistant running in the terminal. Version ${GRENTU_VERSION}. Help the user with coding tasks, answer questions, and provide clear explanations.`,
        },
        ...messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        { role: "user", content: text },
      ];

      await provider.stream(llmMessages, config.model, {
        onToken: (token) => {
          setStreamingText((prev) => prev + token);
        },
        onComplete: (fullText) => {
          setMessages((m) => [
            ...m,
            { id: `a-${Date.now()}`, role: "assistant", content: fullText },
          ]);
          setStreamingText("");
          setIsStreaming(false);
        },
        onError: (err) => {
          setSystemMsg(`Error: ${err.message}`);
          setIsStreaming(false);
          setStreamingText("");
        },
      });
    },
    [cmdCtx, config.model, getProvider, messages],
  );

  const handleCancel = useCallback(() => {
    if (isStreaming) {
      setIsStreaming(false);
      setStreamingText("");
      setSystemMsg("Cancelled.");
    }
  }, [isStreaming]);

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
