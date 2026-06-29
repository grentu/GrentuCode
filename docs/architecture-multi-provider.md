# Multi-Provider Architecture Blueprint — Milestone 2

> Архитектурный документ. Не реализация —blueprint для DEV-агента.
> Основан на анализе кода GrentuCode v0.2.0.

---

## 1. Оценка текущего состояния

### Что есть

| Файл | Роль | Состояние |
|------|------|-----------|
| `src/providers/base.ts` | `LLMProvider` интерфейс | Минимальный: name, models[], stream(). Нет params, нет capabilities, нет tool calls |
| `src/providers/openai.ts` | Единственный провайдер | Рабочий, но хардкодит список моделей, не передаёт параметры генерации |
| `src/config/index.ts` | Плоский конфиг | `{ theme, provider, model, apiKeys, baseUrl }`. Не масштабируется. Shallow merge — баг при частичном обновлении |
| `src/commands/registry.ts` | Slash-команды | `CommandContext.provider` существует, но не используется. Нет `setProvider` |
| `src/ui/App.tsx` | Главный компонент | **Жёстко связан с OpenAIProvider**. `getProvider()` проверяет только openai. Системный промпт инлайн. Версия `v0.1.0` — устарела (package.json = 0.2.0) |

### Проблемы по убыванию влияния

| # | Проблема | Влияние |
|---|----------|---------|
| P1 | App.tsx хардкодит `OpenAIProvider` | Невозможно добавить провайдер без правки App.tsx. Нарушает OCP |
| P2 | `LLMProvider` не имеет params (temperature, maxTokens) | API各异 — Anthropic требует `max_tokens`, Google использует `systemInstruction` |
| P3 | Config плоский + shallow merge | `updateConfig({ apiKeys: { openai: "x" } })` стирает `anthropic` key. Нет per-provider настроек |
| P4 | Нет factory/registry для провайдеров | Каждый вызов создаёт новый экземпляр. Нет точки расширения |
| P5 | Нет fallback/retry | Один провайдер упал — весь запрос упал |
| P6 | `CommandContext` неполный | Нет `setProvider`, `availableProviders`, `availableModels` |
| P7 | Системный промпт инлайн в App.tsx | Дублирование, невозможность кастомизации |
| P8 | `ChatMessageLLM` не поддерживает tool role | Блокирует M3 (Agent Loop) |
| P9 | `GRENTU_VERSION = "v0.1.0"` в App.tsx | Десинхрон с package.json (0.2.0) |

---

## 2. Provider Abstraction

### 2.1. Проблема

Три провайдера имеют фундаментально разные API:

| Аспект | OpenAI | Anthropic | Google Gemini |
|--------|--------|-----------|---------------|
| System prompt | В массиве messages (`role: "system"`) | Отдельный параметр `system` | Отдельный параметр `systemInstruction` |
| Params | `temperature`, `max_tokens` | `temperature`, `max_tokens` (обязательный) | `temperature`, `maxOutputTokens` |
| Streaming | SSE, `delta.content` | SSE, `content_block_delta` | SSE, `candidates[0].content` |
| Tool calls | `tools` + `tool_choice` | `tools` + `tool_choice` | `functionDeclarations` |
| Auth | `apiKey` header | `x-api-key` header | `x-goog-api-key` query param |

Текущий интерфейс не выражает эти различия.

### 2.2. Решение

**Принцип:** интерфейс остаётся единым, провайдер сам решает как мапить. System prompt НЕ выносится в интерфейс — каждый провайдер извлекает `role: "system"` из messages и обрабатывает по-своему.

```ts
// src/providers/base.ts

// ── Message types ──────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;       // base64
  mimeType: string;
}

export type ContentPart = TextContent | ImageContent;

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
}

export interface ChatMessageLLM {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  toolCalls?: ToolCall[];       // для assistant-сообщений с tool calls
  toolCallId?: string;          // для role: "tool" (результат вызова)
}

// ── Generation params ──────────────────────────────────

export interface GenerateParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stop?: string[];
}

// ── Models ─────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
  maxOutput: number;
}

// ── Stream request (консолидированный) ─────────────────

export interface StreamRequest {
  messages: ChatMessageLLM[];
  model: string;
  params?: GenerateParams;
  signal?: AbortSignal;       // для отмены (Ctrl+C)
  tools?: ToolDefinition[];   // M3 — пока не используется
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

// ── Callbacks ──────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  onToolCall?: (calls: ToolCall[]) => void;  // M3
}

// ── Provider interface ─────────────────────────────────

export interface LLMProvider {
  readonly name: string;
  isConfigured(): boolean;
  getModels(): ModelInfo[];
  stream(request: StreamRequest, callbacks: StreamCallbacks): Promise<void>;
}
```

### 2.3. Утилита для system prompt

Каждый провайдер извлекает system prompt по-своему. Общая утилита:

```ts
// src/providers/utils.ts

export function extractSystemPrompt(messages: ChatMessageLLM[]): {
  systemPrompt: string | null;
  conversation: ChatMessageLLM[];
} {
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");
  const systemPrompt = systemMessages.map((m) =>
    typeof m.content === "string" ? m.content : ""
  ).join("\n\n") || null;
  return { systemPrompt, conversation };
}
```

### 2.4. До / После

**До (base.ts):**
```ts
export interface LLMProvider {
  name: string;
  models: string[];
  stream(messages: ChatMessageLLM[], model: string, callbacks: StreamCallbacks): Promise<void>;
}
```

**После:** см. §2.2. Ключевые отличия:
- `stream()` принимает `StreamRequest` (единый объект) вместо 3 позиционных аргументов — расширяемо без breaking changes
- Добавлен `GenerateParams` — temperature, maxTokens, topP, topK, stop
- Добавлен `AbortSignal` для отмены стриминга (вместо текущего `setIsStreaming(false)`, который не останавливает HTTP-запрос)
- Добавлен `isConfigured()` — провайдер сам знает, есть ли у него ключ
- `getModels()` возвращает `ModelInfo[]` вместо `string[]` — метаданные моделей
- `ChatMessageLLM` поддерживает `role: "tool"` и `toolCalls` — задел для M3

### 2.5. Пример: как Anthropic использует это

```ts
// src/providers/anthropic.ts (псевдокод для понимания архитектуры)

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private static MODELS: ModelInfo[] = [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", contextWindow: 200000, maxOutput: 8192 },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1", contextWindow: 200000, maxOutput: 8192 },
  ];

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  isConfigured(): boolean {
    return Boolean(this.client.apiKey);
  }

  getModels(): ModelInfo[] {
    return AnthropicProvider.MODELS;
  }

  async stream(request: StreamRequest, callbacks: StreamCallbacks): Promise<void> {
    const { systemPrompt, conversation } = extractSystemPrompt(request.messages);

    try {
      const stream = await this.client.messages.stream({
        model: request.model,
        max_tokens: request.params?.maxTokens ?? 4096,  // Anthropic требует max_tokens
        system: systemPrompt ?? undefined,               // отдельный параметр, не в messages
        messages: conversation.map(toAnthropicFormat),
        temperature: request.params?.temperature,
      });

      let fullText = "";
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          callbacks.onToken(event.delta.text);
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
```

### 2.6. Tradeoffs

| Решение | Плюс | Минус |
|---------|------|-------|
| `StreamRequest` объект вместо позиционных аргументов | Расширяем без breaking changes | Чуть больше boilerplate при вызове |
| System prompt остаётся в messages, провайдер извлекает | Единый формат для всех | Лишняя работа провайдеру (но это его ответственность) |
| `AbortSignal` в request | Реальная отмена HTTP-запроса | Нужно прокидывать через SDK (openai/anthropic поддерживают) |
| `tools?` в интерфейсе сейчас (не используется до M3) | Задел, не нужно менять интерфейс позже | Мёртвый код до M3 |
| `ContentPart[]` в content (image support) | Задел для vision | Усложняет тип. Можно отложить до M3 если нужен YAGNI |

**Рекомендация:** оставить `ContentPart[]` в дизайне, но реализовать только `string` в M2. Интерфейс уже поддерживает оба — провайдеры проверяют `typeof content`.

---

## 3. Config Structure

### 3.1. Проблема

Текущий конфиг:
```ts
interface GrentuConfig {
  theme: string;
  provider: string;
  model: string;
  apiKeys: { openai?: string; anthropic?: string; google?: string; };
  baseUrl?: string;
}
```

- Плоский — `baseUrl` глобальный, но нужен per-provider (OpenAI и local оба могут иметь свой baseUrl)
- `apiKeys` — фиксированный набор, нельзя добавить кастомный провайдер
- Shallow merge в `loadConfig` и `updateConfig`:
  - `updateConfig({ apiKeys: { openai: "x" } })` → **стирает** `apiKeys.anthropic`
- Нет параметров генерации
- Нет fallback-цепочки
- Нет versioning — нельзя мигрировать

### 3.2. Решение: версионированный конфиг v2

```ts
// src/config/schema.ts

export interface GrentuConfigV2 {
  version: 2;
  theme: string;
  activeProvider: string;
  activeModel: string;
  params?: GenerateParams;           // глобальные дефолты
  providers: Record<string, ProviderConfig>;
  fallback?: string[];               // имена провайдеров для fallback
}

export interface ProviderConfig {
  apiKey?: string;                   // явный ключ
  apiKeyEnv?: string;                // имя env-переменной (приоритет: env > apiKey)
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];                 // переопределение/расширение списка моделей
  params?: GenerateParams;           // per-provider overrides
  enabled?: boolean;                 // можно отключить провайдер не удаляя
}
```

### 3.3. Пример конфига

```json
{
  "version": 2,
  "theme": "neon-forest",
  "activeProvider": "anthropic",
  "activeModel": "claude-sonnet-4-5",
  "params": {
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "providers": {
    "openai": {
      "apiKeyEnv": "OPENAI_API_KEY",
      "defaultModel": "gpt-4o"
    },
    "anthropic": {
      "apiKeyEnv": "ANTHROPIC_API_KEY",
      "defaultModel": "claude-sonnet-4-5",
      "params": { "maxTokens": 8192 }
    },
    "google": {
      "apiKeyEnv": "GOOGLE_API_KEY",
      "defaultModel": "gemini-2.0-flash"
    },
    "local": {
      "baseUrl": "http://localhost:11434/v1",
      "defaultModel": "llama3",
      "enabled": false
    }
  },
  "fallback": ["openai", "local"]
}
```

### 3.4. Миграция v1 → v2

```ts
// src/config/migrate.ts

import type { GrentuConfig, GrentuConfigV2 } from "./schema";

export function migrateV1toV2(old: GrentuConfig): GrentuConfigV2 {
  return {
    version: 2,
    theme: old.theme,
    activeProvider: old.provider,
    activeModel: old.model,
    providers: {
      openai: {
        apiKey: old.apiKeys.openai,
        apiKeyEnv: "OPENAI_API_KEY",
        baseUrl: old.baseUrl,
        defaultModel: old.model,
      },
      anthropic: {
        apiKey: old.apiKeys.anthropic,
        apiKeyEnv: "ANTHROPIC_API_KEY",
      },
      google: {
        apiKey: old.apiKeys.google,
        apiKeyEnv: "GOOGLE_API_KEY",
      },
    },
  };
}
```

### 3.5. Deep merge для updateConfig

```ts
// src/config/index.ts (переписанный)

export function updateConfig(partial: DeepPartial<GrentuConfigV2>): GrentuConfigV2 {
  const current = loadConfig();
  const updated = deepMerge(current, partial);
  saveConfig(updated);
  return updated;
}
```

`deepMerge` делает рекурсивное слияние для вложенных объектов (`providers.*`, `params`), не заменяя их целиком.

### 3.6. Приоритет ключей

```ts
export function resolveApiKey(config: ProviderConfig): string | undefined {
  // 1. Env-переменная (если указана)
  if (config.apiKeyEnv && process.env[config.apiKeyEnv]) {
    return process.env[config.apiKeyEnv];
  }
  // 2. Явный ключ из конфига
  return config.apiKey;
}
```

### 3.7. До / После

**До:**
```
config.json = { theme, provider, model, apiKeys: {openai?, anthropic?, google?}, baseUrl? }
loadConfig: shallow merge с дефолтами
updateConfig: shallow merge → СТИРАЕТ вложенные ключи
```

**После:**
```
config.json = { version: 2, theme, activeProvider, activeModel, params?, providers: {name: ProviderConfig}, fallback? }
loadConfig: detect version → migrate if v1 → deep merge с дефолтами
updateConfig: deep merge → безопасное частичное обновление
resolveApiKey: env > explicit → единая логика для всех провайдеров
```

### 3.8. Tradeoffs

| Решение | Плюс | Минус |
|---------|------|-------|
| Versioning + миграция | backward compatible, безопасный апгрейд | лишний код миграции |
| `providers: Record<string, ProviderConfig>` | любой провайдер, per-provider настройки | сложнее валидация |
| `apiKeyEnv` + `apiKey` | гибкость: env для CI, явный для локала | две опции — надо документировать |
| `params` глобальные + per-provider | layered defaults | 3 уровня приоритета (глобал → provider → запрос) — нужно чётко задокументировать |
| Deep merge | безопасные partial updates | нужен кастомный deepMerge (~15 строк) |

---

## 4. Provider Registry / Factory

### 4.1. Опции

| Паттерн | Сложность | Расширяемость | Подходит для M5 (MCP)? |
|---------|-----------|---------------|------------------------|
| A. Switch factory | Низкая | Плохая — каждый провайдер = case | Нет |
| B. Registry map | Низкая | Хорошая — register(name, factory) | Да — основа для плагинов |
| C. Plugin system | Высокая | Отличная — external modules | Избыточно для M2 |

### 4.2. Решение: Registry map (B)

```ts
// src/providers/registry.ts

import type { LLMProvider } from "./base";
import type { ProviderConfig } from "../config/schema";

export type ProviderFactory = (config: ProviderConfig) => LLMProvider;

class ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();

  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  unregister(name: string): void {
    this.factories.delete(name);
  }

  create(name: string, config: ProviderConfig): LLMProvider | null {
    const factory = this.factories.get(name);
    if (!factory) return null;
    return factory(config);
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}

// Singleton
export const providerRegistry = new ProviderRegistry();
```

### 4.3. Авторегистрация встроенных провайдеров

```ts
// src/providers/index.ts

import { providerRegistry } from "./registry";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { LocalProvider } from "./local";

export function registerBuiltInProviders(): void {
  providerRegistry.register("openai", (cfg) => new OpenAIProvider(cfg));
  providerRegistry.register("anthropic", (cfg) => new AnthropicProvider(cfg));
  providerRegistry.register("google", (cfg) => new GoogleProvider(cfg));
  providerRegistry.register("local", (cfg) => new LocalProvider(cfg));
}

export { providerRegistry };
```

### 4.4. Путь к M5 (MCP/Plugins)

Registry map уже **является** основой плагинной системы. Для M5 достаточно:

```ts
// Будущее (M5) — загрузка внешних провайдеров
export async function loadProviderPlugin(modulePath: string): Promise<void> {
  const mod = await import(modulePath);
  if (mod.default && typeof mod.default.register === "function") {
    mod.default.register(providerRegistry);
  }
}
```

Интерфейс `ProviderFactory` не меняется. Плагин просто вызывает `providerRegistry.register(name, factory)`.

### 4.5. Кэширование экземпляров

Текущий код создаёт `new OpenAIProvider()` на каждый запрос. Registry можно расширить кэшированием:

```ts
class ProviderRegistry {
  private instances = new Map<string, LLMProvider>();

  getOrCreate(name: string, config: ProviderConfig): LLMProvider | null {
    // Кэш по name — конфиг меняется редко
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }
    const provider = this.create(name, config);
    if (provider) this.instances.set(name, provider);
    return provider;
  }

  invalidate(name?: string): void {
    if (name) this.instances.delete(name);
    else this.instances.clear();
  }
}
```

**Tradeoff:** кэш безопасен, если провайдер не хранит состояние между запросами. OpenAIProvider уже использует lazy init для клиента — кэш убирает повторные создания SDK-клиента. При смене apiKey через `/provider` — вызываем `invalidate(name)`.

---

## 5. Fallback Chain

### 5.1. Опции

| Паттерн | Сложность | Когда подходит |
|---------|-----------|----------------|
| A. Simple try-next | Низкая | M2 — базовая отказоустойчивость |
| B. Retry + try-next | Средняя | M2 — retry для transient errors (429, 500) |
| C. Circuit breaker | Высокая | M5+ — постоянные провайдеры, long-running |

### 5.2. Решение: Retry + try-next (B), design для circuit breaker

```ts
// src/providers/router.ts

import type { LLMProvider, StreamRequest, StreamCallbacks, ErrorLike } from "./base";
import type { ProviderRegistry } from "./registry";
import type { GrentuConfigV2 } from "../config/schema";
import { resolveApiKey } from "../config";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

function isRetryable(err: unknown): boolean {
  const status = (err as ErrorLike)?.status ?? (err as ErrorLike)?.response?.status;
  return status != null && RETRYABLE_STATUS.has(status);
}

export class ProviderRouter {
  constructor(
    private registry: ProviderRegistry,
    private config: GrentuConfigV2,
  ) {}

  async stream(request: StreamRequest, callbacks: StreamCallbacks): Promise<void> {
    const chain = this.getProviderChain();
    let lastError: Error | null = null;

    for (const providerName of chain) {
      const providerConfig = this.config.providers[providerName];
      if (!providerConfig?.enabled && providerConfig !== undefined) continue;

      const provider = this.registry.getOrCreate(providerName, providerConfig ?? {});
      if (!provider || !provider.isConfigured()) continue;

      // Retry loop для transient errors
      let attempt = 0;
      while (attempt <= MAX_RETRIES) {
        try {
          await provider.stream(this.buildRequest(request, providerName), callbacks);
          return;  // успех
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < MAX_RETRIES && isRetryable(err)) {
            attempt++;
            await sleep(500 * attempt);  // linear backoff
            continue;
          }
          break;  // non-retryable или retries exhausted → next provider
        }
      }
    }

    callbacks.onError(lastError ?? new Error("No providers available"));
  }

  private getProviderChain(): string[] {
    const chain = [this.config.activeProvider, ...(this.config.fallback ?? [])];
    return [...new Set(chain.filter(Boolean))];
  }

  private buildRequest(request: StreamRequest, providerName: string): StreamRequest {
    // Merдж params: глобальные ← provider-specific ← request-specific
    const providerConfig = this.config.providers[providerName];
    return {
      ...request,
      params: {
        ...this.config.params,
        ...providerConfig?.params,
        ...request.params,
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 5.3. Параметры: 3 уровня приоритета

```
Запрос (runtime)  ←  Provider config  ←  Global config
   highest priority        middle              lowest
```

```ts
// Пример:
// Global:  { temperature: 0.7, maxTokens: 4096 }
// Provider anthropic: { maxTokens: 8192 }
// Запрос: { temperature: 0.9 }
// Результат: { temperature: 0.9, maxTokens: 8192 }
```

### 5.4. Circuit breaker (задел на M5)

Текущий дизайн не блокирует добавление circuit breaker. Точка интеграции — `ProviderRouter.stream()`:

```ts
// Будущее (M5):
if (this.circuitBreaker.isOpen(providerName)) {
  continue;  // skip provider in open state
}
// ... after failure:
this.circuitBreaker.recordFailure(providerName);
```

Circuit breaker — отдельный класс, не влияет на текущий интерфейс.

### 5.5. Tradeoffs

| Решение | Плюс | Минус |
|---------|------|-------|
| Retry для transient errors | 429/503 не убивают запрос | Латентность при retry (до 1с при MAX_RETRIES=2) |
| Linear backoff (500ms * attempt) | Просто, предсказуемо | Менее эффективно чем exponential + jitter |
| try-next без callback-уведомления | Просто | Пользователь не видит, что переключились на fallback |
| `getProviderChain()` dedup | Защита от дублей в конфиге | — |

**Рекомендация:** добавить опциональный `onProviderSwitch?: (from: string, to: string) => void` в `StreamCallbacks` — TUI показывает "Switched to fallback: openai".

---

## 6. Command System

### 6.1. Проблема

`CommandContext` имеет поле `provider`, но:
- Нет `setProvider`
- Нет списка доступных провайдеров
- Нет списка моделей текущего провайдера
- `/provider` команды не существует

### 6.2. Решение: расширенный CommandContext

```ts
// src/commands/registry.ts (обновлённый)

export interface CommandContext {
  // Текущие значения
  model: string;
  provider: string;
  theme: string;

  // Метаданные для команд
  availableProviders: ProviderInfo[];      // [{ name, configured, models }]
  availableModels: ModelInfo[];            // модели текущего провайдера

  // Setters
  setTheme: (name: string) => void;
  setModel: (name: string) => void;
  setProvider: (name: string) => void;     // NEW — также ставит defaultModel
  clearMessages: () => void;
  exit: () => void;
}

export interface ProviderInfo {
  name: string;
  configured: boolean;   // есть ли apiKey
  models: ModelInfo[];
}
```

### 6.3. Команда /provider

```ts
const providerCommand: CommandHandler = (args, ctx) => {
  if (!args.trim()) {
    // Показать текущий + список
    const list = ctx.availableProviders
      .map((p) => {
        const marker = p.name === ctx.provider ? "→" : " ";
        const status = p.configured ? "" : " (no API key)";
        return `  ${marker} ${p.name.padEnd(12)}${status}`;
      })
      .join("\n");
    return {
      output: `Current provider: ${ctx.provider}\n\nAvailable:\n${list}\n\nTo change: /provider <name>`,
    };
  }

  const name = args.trim();
  const found = ctx.availableProviders.find((p) => p.name === name);
  if (!found) {
    return {
      output: `Unknown provider: ${name}. Available: ${ctx.availableProviders.map((p) => p.name).join(", ")}`,
    };
  }
  if (!found.configured) {
    return {
      output: `Provider "${name}" is not configured. Set API key in ~/.grentu/config.json or env var.`,
    };
  }

  ctx.setProvider(name);
  // setProvider также ставит defaultModel провайдера
  return {
    output: `Provider changed to: ${name}\nModel: ${found.models[0]?.id ?? "unknown"}`,
  };
};
```

### 6.4. Поведение `setProvider`

При смене провайдера:
1. `config.activeProvider = name`
2. `config.activeModel = providers[name].defaultModel ?? provider.getModels()[0].id`
3. `registry.invalidate(name)` — пересоздать с новым конфигом
4. Сохранить конфиг

Это значит `setProvider` в App.tsx делает **две** вещи: меняет провайдер и модель. Это правильно — модель от старого провайдера не валидна для нового.

### 6.5. Tradeoffs

| Решение | Плюс | Минус |
|---------|------|-------|
| `availableProviders: ProviderInfo[]` в контексте | Команды имеют всю инфу | Контекст растёт |
| `setProvider` ставит defaultModel | Не остаёмся с невалидной моделью | Меняем две вещи за раз (но это правильно) |
| `configured` флаг | UI может показать "не настроен" | Нужно проверять isConfigured() при билдинге контекста |

---

## 7. App.tsx Decoupling

### 7.1. Проблема (Before)

```tsx
// App.tsx — текущий код (проблемные места)

import { OpenAIProvider } from "../providers/openai";  // ПРЯМОЙ ИМПОРТ

const getProvider = useCallback((): LLMProvider | null => {
  const apiKey = config.apiKeys.openai ?? process.env.OPENAI_API_KEY;  // ТОЛЬКО OpenAI
  if (!apiKey) {
    setSystemMsg("No API key found. Set OPENAI_API_KEY...");
    return null;
  }
  return new OpenAIProvider(apiKey, config.baseUrl);  // ХАРДКОД
}, [config.apiKeys.openai, config.baseUrl]);

// Системный промпт инлайн:
const llmMessages: ChatMessageLLM[] = [
  { role: "system", content: `You are Grentu Code... Version ${GRENTU_VERSION}...` },  // ИНЛАЙН
  ...messages,
];

await provider.stream(llmMessages, config.model, { onToken, onComplete, onError });  // 3 позиционных
```

### 7.2. Решение (After)

```tsx
// App.tsx — после рефакторинга

// НЕТ импорта конкретных провайдеров
import { providerRegistry, registerBuiltInProviders } from "../providers";
import { ProviderRouter } from "../providers/router";
import { getSystemPrompt } from "../prompts/system";
import { loadConfig, saveConfig, updateConfig, type GrentuConfigV2 } from "../config";

// Инициализация — один раз при старте
registerBuiltInProviders();

function GrentuApp() {
  const [config, setConfig] = useState<GrentuConfigV2>(() => loadConfig());
  // ...

  // Router создаётся из конфига — сам резолвит провайдеров
  const router = useMemo(
    () => new ProviderRouter(providerRegistry, config),
    [config.activeProvider, config.fallback, config.providers, config.params],
  );

  const handleSetProvider = useCallback((name: string) => {
    setConfig((c) => {
      const providerConfig = c.providers[name];
      const defaultModel = providerConfig?.defaultModel
        ?? providerRegistry.getOrCreate(name, providerConfig ?? {})?.getModels()[0]?.id
        ?? c.activeModel;
      providerRegistry.invalidate(name);  // пересоздать с актуальным конфигом
      const updated = updateConfig({ activeProvider: name, activeModel: defaultModel });
      return updated;
    });
  }, []);

  // ... handleSetModel, handleSetTheme — аналогично через updateConfig

  const cmdCtx: CommandContext = {
    model: config.activeModel,
    provider: config.activeProvider,
    theme: config.theme,
    availableProviders: buildProviderInfo(config),     // helper
    availableModels: providerRegistry
      .getOrCreate(config.activeProvider, config.providers[config.activeProvider] ?? {})
      ?.getModels() ?? [],
    setTheme: handleSetTheme,
    setModel: handleSetModel,
    setProvider: handleSetProvider,
    clearMessages: handleClear,
    exit: handleExit,
  };

  const handleSubmit = useCallback(async (text: string) => {
    // ... command handling ...

    const llmMessages: ChatMessageLLM[] = [
      { role: "system", content: getSystemPrompt(GRENTU_VERSION) },  // ВЫНЕСЕНО
      ...messages.filter((m) => m.role !== "system").map(toLLM),
      { role: "user", content: text },
    ];

    // Единый вызов — router сам выбирает провайдера + fallback
    await router.stream(
      { messages: llmMessages, model: config.activeModel },
      {
        onToken: (token) => setStreamingText((prev) => prev + token),
        onComplete: (fullText) => { /* ... */ },
        onError: (err) => { /* ... */ },
      },
    );
  }, [router, config.activeModel, messages]);
}
```

### 7.3. Системный промпт — отдельный модуль

```ts
// src/prompts/system.ts

import { readFileSync } from "fs";
import { join } from "path";
import { GRENTU_DIR } from "../config";

export function getSystemPrompt(version: string): string {
  // 1. Кастомный промпт из ~/.grentu/system-prompt.md (если есть)
  const customPath = join(GRENTU_DIR, "system-prompt.md");
  try {
    const custom = readFileSync(customPath, "utf-8");
    return custom.replace("{{VERSION}}", version);
  } catch {
    // 2. Дефолтный
  }

  return `You are Grentu Code, an AI coding assistant running in the terminal. Version ${version}. Help the user with coding tasks, answer questions, and provide clear explanations.`;
}
```

**Tradeoff:** файловая система при каждом запросе — но `system-prompt.md` читается редко (только если файл существует). Можно кэшировать с invalidate при изменении. Для M2 — достаточно try/catch, для M3 — file watcher.

### 7.4. Что меняется

| Было | Стало |
|------|-------|
| `import { OpenAIProvider }` | `import { providerRegistry, registerBuiltInProviders }` |
| `new OpenAIProvider(apiKey, baseUrl)` | `ProviderRouter` создаёт провайдеров через registry |
| `getProvider()` — 10 строк, хардкод OpenAI | Удалено. Router делает всё |
| Системный промпт инлайн | `getSystemPrompt()` из `src/prompts/system.ts` |
| `provider.stream(messages, model, callbacks)` | `router.stream({messages, model}, callbacks)` |
| `config.apiKeys.openai` | `config.providers.openai.apiKey` (через `resolveApiKey`) |
| `GRENTU_VERSION = "v0.1.0"` (устаревшая) | Чтение из `package.json` или константа `v0.2.0` |

### 7.5. Версия

```ts
// src/version.ts
import packageJson from "../../package.json" with { type: "json" };
export const GRENTU_VERSION = `v${packageJson.version}`;
```

Или проще — синхронизировать вручную, но вынести в отдельный файл:

```ts
// src/version.ts
export const GRENTU_VERSION = "v0.2.0";
```

**Рекомендация:** чтение из package.json через `resolveJsonModule: true` (уже включён в tsconfig). Один источник истины.

---

## 8. Итоговая структура файлов

```
src/
├── version.ts                     # NEW — GRENTU_VERSION из package.json
├── prompts/
│   └── system.ts                  # NEW — getSystemPrompt()
├── providers/
│   ├── base.ts                    # REWRITE — расширенный интерфейс (§2.2)
│   ├── utils.ts                   # NEW — extractSystemPrompt(), message mappers
│   ├── registry.ts                # NEW — ProviderRegistry (§4.2)
│   ├── router.ts                  # NEW — ProviderRouter + fallback (§5.2)
│   ├── index.ts                   # NEW — registerBuiltInProviders(), exports
│   ├── openai.ts                  # REFACTOR — implements new interface
│   ├── anthropic.ts               # NEW — AnthropicProvider (DEV пишет)
│   ├── google.ts                  # NEW — GoogleProvider (DEV пишет)
│   └── local.ts                   # NEW — LocalProvider (OpenAI-compatible, DEV пишет)
├── config/
│   ├── schema.ts                  # NEW — GrentuConfigV2, ProviderConfig types (§3.2)
│   ├── migrate.ts                 # NEW — migrateV1toV2() (§3.4)
│   └── index.ts                   # REFACTOR — deepMerge, version detection, resolveApiKey
├── commands/
│   ├── registry.ts                # REFACTOR — расширенный CommandContext, /provider (§6)
│   └── (будущее: help.ts, model.ts, ... — ROADMAP §1.4)
└── ui/
    └── App.tsx                    # REFACTOR — decouple from OpenAIProvider (§7)
```

### Порядок реализации (для DEV-агента)

```
Шаг 1: config/schema.ts + config/migrate.ts + config/index.ts (refactor)
       ↓ зависимость от типов
Шаг 2: providers/base.ts (rewrite) + providers/utils.ts
       ↓
Шаг 3: providers/registry.ts + providers/index.ts
       ↓
Шаг 4: providers/openai.ts (refactor под новый интерфейс)
       ↓ (проверить что OpenAI работает)
Шаг 5: providers/router.ts
       ↓
Шаг 6: providers/anthropic.ts + google.ts + local.ts (новые)
       ↓
Шаг 7: prompts/system.ts + version.ts
       ↓
Шаг 8: commands/registry.ts (refactor CommandContext + /provider)
       ↓
Шаг 9: ui/App.tsx (refactor — decouple)
       ↓
Шаг 10: Тест — все провайдеры, fallback, /provider, миграция конфига
```

**Каждый шаг — компилируется.** Между шагами 4 и 9 App.tsx временно не работает — поэтому шаги 2-4 можно делать как один коммит, или держать App.tsx на старом интерфейсе до шага 9 через временный адаптер.

### Альтернатива: временный адаптер

Чтобы App.tsx работал между шагами 2 и 9:

```ts
// Временный адаптер в openai.ts (шаг 4)
export class OpenAIProvider implements LLMProvider {
  // Новый интерфейс
  stream(request: StreamRequest, callbacks: StreamCallbacks): Promise<void> { ... }

  // Временный legacy-метод для App.tsx пока не отрефакторен
  streamLegacy(messages: ChatMessageLLM[], model: string, callbacks: StreamCallbacks): Promise<void> {
    return this.stream({ messages, model }, callbacks);
  }
}
```

Удаляется на шаге 9.

---

## 9. Риски и побочные эффекты

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Shallow merge в old config уже привёл к потере ключей у юзеров | Средняя | Данные | Миграция v1→v2 читает старый формат как есть, не пытается "починить" |
| `AbortSignal` не поддерживается старыми SDK | Низкая | Отмена стрима | openai SDK ^4.77 поддерживает. Anthropic SDK — проверить. Fallback: timeout |
| `getModels()` для local провайдера — нужен HTTP-запрос к Ollama | Средняя | Латентность при /provider | Сделать `getModels()` async в M3, или кэшировать список моделей в конфиге |
| Registry singleton — глобальное состояние | Низкая | Тестируемость | Для тестов: `new ProviderRegistry()` вместо singleton. `providerRegistry` — только для app |
| Router пересоздаётся при каждом изменении config | Низкая | Performance | `useMemo` с правильными deps. Registry кэширует экземпляры |
| `ContentPart[]` в типе, но не реализован | Низкая | Путаница | Документировать: "string-only в M2, ContentPart[] в M3" |

---

## 10. Чек-лист соответствия требованиям

| Требование | Решение | Раздел |
|------------|---------|--------|
| Provider abstraction (Anthropic system, Google systemInstruction, local) | Единый интерфейс, провайдер извлекает system prompt | §2 |
| Params (temperature, maxTokens) | `GenerateParams` в `StreamRequest`, 3 уровня приоритета | §2.2, §5.3 |
| Config per-provider, fallback, backward compat | `GrentuConfigV2` + миграция v1→v2 | §3 |
| Registry/factory pattern | `ProviderRegistry` map, path to plugins (M5) | §4 |
| Fallback chain | `ProviderRouter`: retry + try-next, circuit breaker ready | §5 |
| /provider command integration | Расширенный `CommandContext` + `/provider` | §6 |
| App.tsx decoupling | Router + Registry, no direct provider imports | §7 |

---

## 11. Что НЕ делать (YAGNI для M2)

| Идея | Почему отложить |
|------|-----------------|
| Plugin loading из external modules | M5 — MCP. Registry уже готов, loading — позже |
| Circuit breaker | Нет постоянных long-running сессий в M2. Retry достаточно |
| `getModels()` async (HTTP-запрос к API) | Латентность. Статичные списки в M2, dynamic в M3 |
| Image/multimodal support | M3+ (Agent Loop + vision tools) |
| Streaming tool calls | M3 (Agent Loop) |
| Config validation через zod | Хорошо, но не критично для M2. Добавить в M7 (Polish) |
| Hot-reload конфига | M4 (Sessions) — config watcher |
| Cost tracking (token count → $$) | M3 (Token management) |
