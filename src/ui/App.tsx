import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Text, Box, render, useApp, useInput } from "ink";
import { Banner } from "./Banner";
import { Onboarding } from "./Onboarding";
import { Input } from "./Input";
import { Messages } from "./Messages";
import type { ChatMessage, ToolCallInfo } from "./Messages";
import { Spinner } from "./Spinner";
import { getTheme } from "./theme";
import { ProviderMenu } from "./ProviderMenu";
import { RemoveProviderMenu } from "./RemoveProviderMenu";
import { ProviderSetup } from "./ProviderSetup";
import type { ProviderSetupData } from "./ProviderSetup";
import { ApiKeyInput } from "./ApiKeyInput";
import { PermissionPrompt } from "./PermissionPrompt";
import { executeCommand, type CommandContext } from "../commands/registry";
import {
  configExists,
  loadConfig,
  saveConfig,
  type GrentuConfig,
} from "../config";
import { createProvider, getCustomProviderNames, PROVIDER_NAMES, BUILTIN_PROVIDERS } from "../providers/registry";
import type { LLMProvider, ChatMessageLLM } from "../providers/base";
import { runAgentLoop } from "../tools/agentLoop";
import { VERSION } from "../version";
import * as path from "path";
import * as fs from "fs";

type OverlayMode = "menu" | "remove" | "setup" | "apikey" | null;

interface PendingPermission {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (allowed: boolean) => void;
}

function detectProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function buildSystemPrompt(workDir: string): string {
  let projectInfo = "";
  try {
    const entries = fs.readdirSync(workDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules").map((e) => e.name);
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    projectInfo = `\n\nProject structure (root: ${workDir}):\nDirectories: ${dirs.join(", ") || "none"}\nFiles: ${files.slice(0, 20).join(", ")}`;
  } catch {}

  return `You are Grentu Code, an AI coding assistant running in the terminal. Version ${VERSION}.

You have tools available: read_file, write_file, edit_file, run_command, search. Use them to help the user with coding tasks. Always explain what you're doing before using a tool. When a task requires file operations or commands, use the appropriate tool.${projectInfo}`;
}

function GrentuApp() {
  const { exit: exitApp } = useApp();
  const [config, setConfig] = useState<GrentuConfig>(() => loadConfig());
  const [needsOnboarding, setNeedsOnboarding] = useState(() => !configExists());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [systemMsg, setSystemMsg] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayMode>(null);
  const [apiKeyTarget, setApiKeyTarget] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const permissionResolverRef = useRef<((allowed: boolean) => void) | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const theme = getTheme(config.theme);
  const projectRoot = useMemo(() => detectProjectRoot(), []);

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
          const defaultModel = c.providers?.[name]?.defaultModel;
          const targetModel = defaultModel && providerModels.includes(defaultModel)
            ? defaultModel
            : providerModels[0];
          updated = { ...updated, model: targetModel };
        } else {
          const provider = createProvider(name, c);
          if (provider && provider.models.length > 0) {
            updated = { ...updated, model: provider.models[0] };
          }
        }
      }
      saveConfig(updated);
      return updated;
    });
  }, []);

  const handleRemoveProvider = useCallback((name: string): boolean => {
    let success = false;
    setConfig((c) => {
      if (!c.providers || !(name in c.providers)) return c;
      if (BUILTIN_PROVIDERS.has(name)) return c;
      const newProviders = { ...c.providers };
      delete newProviders[name];
      let updated: GrentuConfig = { ...c, providers: newProviders };
      if (c.provider === name) {
        updated = { ...updated, provider: "openai", model: "gpt-4o" };
      }
      if (c.fallback) {
        updated = { ...updated, fallback: c.fallback.filter((f) => f !== name) };
      }
      saveConfig(updated);
      success = true;
      return updated;
    });
    return success;
  }, []);

  const handleProviderSetupComplete = useCallback((data: ProviderSetupData) => {
    setConfig((c) => {
      const newProviders = { ...(c.providers ?? {}), [data.name]: data.config };
      const models = data.config.models ?? [];
      const updated: GrentuConfig = {
        ...c,
        providers: newProviders,
        provider: data.name,
        model: data.config.defaultModel ?? models[0] ?? c.model,
      };
      saveConfig(updated);
      return updated;
    });
    setOverlay(null);
    setSystemMsg(`Custom provider '${data.name}' added and activated.`);
  }, []);

  const handleProviderSetupCancel = useCallback(() => {
    setOverlay(null);
    setSystemMsg("Provider setup cancelled.");
  }, []);

  const handleApiKeyComplete = useCallback((apiKey: string) => {
    if (!apiKeyTarget) return;
    setConfig((c) => {
      const newProviders = {
        ...(c.providers ?? {}),
        [apiKeyTarget]: { ...(c.providers?.[apiKeyTarget] ?? {}), apiKey },
      };
      const updated: GrentuConfig = { ...c, providers: newProviders, provider: apiKeyTarget };
      const envMap: Record<string, string> = {
        openai: "gpt-4o",
        anthropic: "claude-sonnet-4-20250514",
        google: "gemini-2.0-flash",
      };
      if (envMap[apiKeyTarget]) updated.model = envMap[apiKeyTarget];
      saveConfig(updated);
      return updated;
    });
    setOverlay(null);
    setSystemMsg(`Provider '${apiKeyTarget}' configured and activated.`);
    setApiKeyTarget(null);
  }, [apiKeyTarget]);

  const handleApiKeyCancel = useCallback(() => {
    setOverlay(null);
    setApiKeyTarget(null);
    setSystemMsg("API key input cancelled.");
  }, []);

  const handleMenuSelect = useCallback((providerName: string) => {
    if (BUILTIN_PROVIDERS.has(providerName) && providerName !== "local") {
      const pc = config.providers?.[providerName];
      const envKey = providerName === "openai" ? process.env.OPENAI_API_KEY
        : providerName === "anthropic" ? process.env.ANTHROPIC_API_KEY
        : providerName === "google" ? process.env.GOOGLE_API_KEY
        : undefined;
      if (!pc?.apiKey && !envKey) {
        setApiKeyTarget(providerName);
        setOverlay("apikey");
        return;
      }
    }
    handleSetProvider(providerName);
    setOverlay(null);
    setSystemMsg(`Provider switched to '${providerName}'.`);
  }, [config.providers, handleSetProvider]);

  const handleMenuAddCustom = useCallback(() => setOverlay("setup"), []);
  const handleMenuRemove = useCallback(() => setOverlay("remove"), []);
  const handleMenuCancel = useCallback(() => setOverlay(null), []);

  const handleRemoveProviderMenuRemove = useCallback((name: string) => {
    handleRemoveProvider(name);
    setOverlay(null);
    setSystemMsg(`Custom provider '${name}' removed.`);
  }, [handleRemoveProvider]);

  const handleRemoveProviderMenuBack = useCallback(() => setOverlay("menu"), []);

  const cmdCtx: CommandContext = useMemo(() => {
    const customNames = getCustomProviderNames(config);
    const availableProviders = [...PROVIDER_NAMES, ...customNames];
    return {
      model: config.model,
      provider: config.provider,
      theme: config.theme,
      availableProviders,
      getProviderModels: (name: string) => {
        const providerConfig = config.providers?.[name];
        if (providerConfig?.models && providerConfig.models.length > 0) return providerConfig.models;
        const provider = createProvider(name, config);
        return provider ? provider.models : [];
      },
      setTheme: handleSetTheme,
      setModel: handleSetModel,
      setProvider: handleSetProvider,
      removeProvider: handleRemoveProvider,
      clearMessages: handleClear,
      exit: handleExit,
    };
  }, [config, handleSetTheme, handleSetModel, handleSetProvider, handleRemoveProvider, handleClear, handleExit]);

  const handleOnboardingComplete = useCallback((themeName: string) => {
    const newConfig = { ...config, theme: themeName };
    saveConfig(newConfig);
    setConfig(newConfig);
    setNeedsOnboarding(false);
  }, [config]);

  const getProviderInstance = useCallback((): LLMProvider | null => {
    return createProvider(config.provider, config);
  }, [config]);

  const handlePermissionAllow = useCallback(() => {
    if (permissionResolverRef.current) {
      permissionResolverRef.current(true);
      permissionResolverRef.current = null;
    }
    setPendingPermission(null);
  }, []);

  const handlePermissionDeny = useCallback(() => {
    if (permissionResolverRef.current) {
      permissionResolverRef.current(false);
      permissionResolverRef.current = null;
    }
    setPendingPermission(null);
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      if (pendingPermission) return;

      const cmdResult = executeCommand(text, cmdCtx);
      if (cmdResult) {
        if (cmdResult.action === "exit") return;
        if (cmdResult.action === "provider-menu") {
          setOverlay("menu");
          setSystemMsg(null);
          return;
        }
        if (cmdResult.action === "provider-add") {
          setOverlay("setup");
          setSystemMsg(null);
          return;
        }
        if (cmdResult.output) setSystemMsg(cmdResult.output);
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

      const provider = getProviderInstance();
      if (!provider) {
        setSystemMsg(
          "No API key found. Use /provider to configure a provider.",
        );
        setIsStreaming(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const llmMessages: ChatMessageLLM[] = [
        ...messagesRef.current
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant" | "tool",
            content: m.content,
            toolCalls: m.toolCalls?.map((tc) => ({
              id: `call_${tc.name}_${Date.now()}`,
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            })),
          })),
        { role: "user", content: text },
      ];

      const systemPrompt = buildSystemPrompt(projectRoot);

      const assistantMsgId = `a-${Date.now()}`;
      let currentAssistantText = "";
      const toolCallInfos: ToolCallInfo[] = [];

      try {
        const result = await runAgentLoop({
          provider,
          model: config.model,
          messages: llmMessages,
          systemPrompt,
          workingDirectory: projectRoot,
          maxIterations: 20,
          params: {
            ...(config.temperature !== undefined && { temperature: config.temperature }),
            ...(config.maxTokens !== undefined && { maxTokens: config.maxTokens }),
          },
          signal: controller.signal,
          onToken: (token) => {
            if (controller.signal.aborted) return;
            currentAssistantText += token;
            setStreamingText(currentAssistantText);
          },
          onAssistantMessage: (text) => {
            currentAssistantText = text;
          },
          onToolCall: (toolName, args) => {
            const tcInfo: ToolCallInfo = { name: toolName, args, pending: true };
            toolCallInfos.push(tcInfo);
            setMessages((m) => [
              ...m,
              {
                id: `${assistantMsgId}-tool-${toolCallInfos.length}`,
                role: "assistant",
                content: "",
                toolCalls: [tcInfo],
              },
            ]);
            setStreamingText("");
          },
          onToolResult: (toolName, toolResult) => {
            const tc = toolCallInfos.find((t) => t.name === toolName && t.pending);
            if (tc) {
              tc.pending = false;
              tc.result = toolResult.success ? toolResult.output : undefined;
              tc.error = toolResult.error;
            }
            setMessages((m) => [...m]);
          },
          onPermissionRequest: (toolName, args) => {
            return new Promise<boolean>((resolve) => {
              permissionResolverRef.current = resolve;
              setPendingPermission({ toolName, args, resolve });
            });
          },
        });

        if (!controller.signal.aborted) {
          setMessages((m) => [
            ...m,
            {
              id: assistantMsgId,
              role: "assistant",
              content: result.finalText || currentAssistantText,
            },
          ]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setSystemMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        setStreamingText("");
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [cmdCtx, config.model, config.temperature, config.maxTokens, getProviderInstance, isStreaming, pendingPermission, projectRoot],
  );

  const handleCancel = useCallback(() => {
    if (isStreaming) {
      abortRef.current?.abort();
      setIsStreaming(false);
      setStreamingText("");
      setSystemMsg("Cancelled.");
    } else if (pendingPermission) {
      handlePermissionDeny();
    } else {
      exitApp();
    }
  }, [isStreaming, pendingPermission, exitApp, handlePermissionDeny, abortRef]);

  useInput((input, key) => {
    if (needsOnboarding) return;
    if (overlay) return;
    if (pendingPermission) return;
    if (key.ctrl && input === "d") {
      handleExit();
    }
  });

  if (needsOnboarding) {
    return React.createElement(Onboarding, { onComplete: handleOnboardingComplete });
  }

  if (overlay === "menu") {
    return React.createElement(ProviderMenu, {
      config,
      onSelect: handleMenuSelect,
      onAddCustom: handleMenuAddCustom,
      onRemove: handleMenuRemove,
      onCancel: handleMenuCancel,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      mutedColor: theme.muted,
      accentColor: theme.accent,
    });
  }

  if (overlay === "remove") {
    return React.createElement(RemoveProviderMenu, {
      config,
      onRemove: handleRemoveProviderMenuRemove,
      onBack: handleRemoveProviderMenuBack,
      primaryColor: theme.primary,
      mutedColor: theme.muted,
      accentColor: theme.accent,
    });
  }

  if (overlay === "setup") {
    const customNames = getCustomProviderNames(config);
    const existing = [...PROVIDER_NAMES, ...customNames];
    return React.createElement(ProviderSetup, {
      existingProviders: existing,
      onComplete: handleProviderSetupComplete,
      onCancel: handleProviderSetupCancel,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      mutedColor: theme.muted,
      accentColor: theme.accent,
    });
  }

  if (overlay === "apikey" && apiKeyTarget) {
    return React.createElement(ApiKeyInput, {
      providerName: apiKeyTarget,
      onComplete: handleApiKeyComplete,
      onCancel: handleApiKeyCancel,
    });
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
      accentColor: theme.accent,
    }),
    isStreaming && streamingText
      ? React.createElement(
          Box,
          { flexDirection: "column", marginTop: 1 },
          React.createElement(Text, { color: theme.secondary, bold: true }, "◆ Grentu"),
          React.createElement(Text, { wrap: "wrap" }, streamingText),
        )
      : null,
    isStreaming && !streamingText && !pendingPermission
      ? React.createElement(Spinner, { color: theme.primary })
      : null,
    pendingPermission
      ? React.createElement(PermissionPrompt, {
          toolName: pendingPermission.toolName,
          args: pendingPermission.args,
          onAllow: handlePermissionAllow,
          onDeny: handlePermissionDeny,
          primaryColor: theme.primary,
          mutedColor: theme.muted,
          accentColor: theme.accent,
        })
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
      disabled: isStreaming || !!pendingPermission,
      onSubmit: handleSubmit,
      onCancel: handleCancel,
    }),
  );
}

export function run() {
  render(React.createElement(GrentuApp));
}
