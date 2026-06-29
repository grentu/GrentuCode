# Grentu Code — Roadmap

> Полноценный AI-ассистент для разработки в терминале. Аналог Claude Code, Codex CLI, Antigravity.
> Стек: TypeScript + Node.js + Ink (React для TUI). Дистрибуция через npm.

---

## Архитектурные решения

| Решение | Выбор |
|---------|-------|
| Язык/стек | TypeScript + Node.js, Ink для TUI |
| Ядро | Своё, с нуля (agent loop, tools, permissions — позже) |
| LLM-провайдеры | Множество нативно: OpenAI, Anthropic, Google, локальные |
| Tools | Отложены — сначала дизайн и базовая интерактивность |
| TUI | Своя эстетика Grentu, функционал как Claude Code |
| Платформы | CLI (первично) → Desktop (позже) |

---

## Milestone 1 — TUI Foundation (MVP дизайн)

**Цель:** Рабочий терминальный интерфейс с базовой интерактивностью, брендингом и стримингом.

### 1.1. Структура проекта и сборка
- [x] Инициализация npm-проекта `grentu`
- [x] TypeScript конфигурация (`tsconfig.json`, target ES2022, module ESM)
- [x] Сборщик: `tsup` (быстрый билд в ESM)
- [x] ESLint + Prettier (в devDependencies)
- [x] Бинарник: `bin/grentu.js` → `dist/index.js` (shebang `#!/usr/bin/env node`)
- [x] `package.json`: name, version, bin, files, engines (node >=18)
- [x] npm link — команда `grentu` доступна глобально
- [x] LICENSE (MIT), .gitignore

### 1.2. Брендинг и баннер
- [x] ASCII-баннер "Grentu" (кастомный, box-drawing, фиксированный размер)
- [ ] Onboarding: выбор цветовой палитры при первом запуске
- [ ] Цветовая схема Grentu (4 встроенных темы + выбор при onboarding)
- [ ] Welcome-сообщение: версия, модель, команда /help
- [ ] Анимация появления баннера (опционально, fade-in через Ink)

### 1.3. Базовый TUI (Ink)
- [x] Главный layout: баннер → история → строка ввода
- [x] Многострочный ввод (показывать prompt `❯` с курсором `▋`)
- [x] Отображение сообщений: user (один цвет), assistant (другой цвет)
- [x] Обработка Ctrl+C (отмена), Ctrl+D (выход), Enter (отправка)
- [x] Спиннер/индикатор "Thinking..." во время запроса к LLM
- [x] TTY-проверка (graceful fallback в не-TTY среде)

### 1.4. Slash-команды
- [x] Парсер: строка начинается с `/` → команда
- [x] `/help` — список доступных команд
- [x] `/clear` — очистить историю чата (экран)
- [x] `/model` — показать/сменить текущую модель
- [x] `/theme` — сменить цветовую палитру
- [x] `/exit` (или `/quit`) — выход
- [x] Unknown command → сообщение об ошибке
- [x] Алиасы: `/h` → `/help`, `/cls` → `/clear`, `/quit` → `/exit`

### 1.5. Стриминг ответов LLM
- [x] Провайдер-агностический интерфейс `LLMProvider`
- [x] Реализация OpenAI-провайдера (стриминг через SSE)
- [x] Потоковый вывод токенов в TUI (typing effect)
- [x] Обработка ошибок стриминга (timeout, network, rate limit)
- [x] Прерывание стриминга по Ctrl+C

### 1.6. Конфигурация (минимальная)
- [x] Файл `~/.grentu/config.json`
- [x] Чтение API-ключей из env vars (`OPENAI_API_KEY`)
- [x] Дефолтная модель и провайдер
- [x] `/model` команда читает/меняет config
- [x] Onboarding: выбор темы при первом запуске, сохранение в config

---

## Milestone 2 — Multi-Provider & Config ✅

**Цель:** Поддержка нескольких LLM-провайдеров с нативными SDK.

- [x] Anthropic-провайдер (Messages API, стриминг, system prompt отдельно)
- [x] Google-провайдер (Gemini API, стриминг, systemInstruction)
- [x] Локальный провайдер (Ollama / llama.cpp, OpenAI-совместимый endpoint)
- [x] Provider Registry — фабрика createProvider(name, config)
- [x] Команда `/provider` — выбор активного провайдера (+ алиас `/p`)
- [x] Расширенный config: per-provider настройки, temperature, maxTokens, fallback
- [x] Fallback-цепочка провайдеров (primary → fallback → auto-discover)
- [x] Поддержка кастомного base_url для OpenAI-совместимых API
- [x] AbortController — отмена стриминга по Ctrl+C
- [x] Миграция конфига v1→v2 (backward compatible)
- [x] File permissions 0o600 для config.json (безопасность API-ключей)
- [x] Единый источник версии (src/version.ts)

---

## Milestone 3 — Agent Loop & Tools ✅

**Цель:** Превратить чат-бот в агента с инструментами.

- [x] Agent loop: LLM → tool call → result → LLM (цикл до завершения, max 20 iterations)
- [x] Tool: `read_file` — чтение файлов (auto-approve, line numbers, max 1MB)
- [x] Tool: `write_file` — запись файлов (permission required, auto-create dirs)
- [x] Tool: `edit_file` — точечное редактирование (permission required, replace_all)
- [x] Tool: `run_command` — выполнение shell-команд (permission required, timeout)
- [x] Tool: `search` — поиск по файлам (auto-approve, content/files modes, regex)
- [x] Система разрешений (auto-approve, ask, deny) — PermissionPrompt UI
- [x] Визуализация tool calls в TUI (⚡ tool name, args, result/error)
- [x] Контекст проекта: auto-detect project root, system prompt with structure
- [x] Provider-agnostic tool calling (OpenAI function calling, Anthropic tool_use, Google functionCall)
- [ ] Token-менеджмент: подсчёт контекста, автоматическое сжатие истории

---

## Milestone 4 — Sessions & Persistence

- [ ] Сохранение/загрузка сессий (`~/.grentu/sessions/`)
- [ ] Команда `/sessions` — список сессий
- [ ] Команда `/resume` — продолжить сессию
- [ ] История команд (arrow up/down как в shell)
- [ ] Export сессии в markdown

---

## Milestone 5 — MCP & Extensions

- [ ] MCP-клиент (Model Context Protocol) — подключение внешних серверов
- [ ] Плагинная система tools
- [ ] Custom slash-commands (через конфиг или плагины)
- [ ] Хуки (pre/post tool execution)
- [ ] Teminal-интеграции: git status в prompt, auto-detect проекта

---

## Milestone 6 — Desktop Version

- [ ] Electron или Tauri оболочка
- [ ] Тот же core, другой рендеринг (веб вместо Ink)
- [ ] Синхронизация конфигов и сессий
- [ ] Дополнительные фичи: multiple tabs, split view, file tree

---

## Milestone 7 — Polish & Release

- [ ] Автодополнение команд (Tab completion)
- [ ] Темная/светлая темы
- [ ] Логирование и telemetry (opt-in)
- [ ] Документация (README, --help, man page)
- [ ] npm publish (проверка имени `grentu` / `grentu-code`)
- [ ] CI/CD: GitHub Actions (build, test, publish)
- [ ] Semver релизы + changelog

---

## Технический стек (детально)

```
grentu-code/
├── bin/
│   └── grentu.js              # entry point (shebang)
├── src/
│   ├── index.ts               # bootstrap, CLI args
│   ├── ui/
│   │   ├── App.tsx            # главный Ink-компонент
│   │   ├── Banner.tsx         # ASCII баннер
│   │   ├── Input.tsx          # строка ввода
│   │   ├── Messages.tsx       # история сообщений
│   │   ├── Spinner.tsx        # индикатор загрузки
│   │   └── theme.ts           # цветовая схема Grentu
│   ├── providers/
│   │   ├── base.ts            # абстрактный LLMProvider
│   │   ├── openai.ts          # OpenAI
│   │   ├── anthropic.ts       # Anthropic (M2)
│   │   ├── google.ts          # Google Gemini (M2)
│   │   └── local.ts           # Ollama/llama.cpp (M2)
│   ├── commands/
│   │   ├── registry.ts        # реестр slash-команд
│   │   ├── help.ts
│   │   ├── clear.ts
│   │   ├── model.ts
│   │   └── exit.ts
│   ├── config/
│   │   └── index.ts           # чтение/запись ~/.grentu/config.json
│   └── utils/
│       ├── stream.ts          # стриминг SSE-парсер
│       └── tokens.ts          # подсчёт токенов (будущее)
├── package.json
├── tsconfig.json
├── tsup.config.ts             # сборщик
└── ROADMAP.md
```

---

## Принятые решения

| Вопрос | Решение |
|--------|---------|
| npm имя | `grentu` |
| Лицензия | MIT |
| Монетизация | Open-source |
| Цветовая палитра | Выбор при первом запуске (onboarding), смена через `/theme` |
| Стиль баннера | Кастомный ASCII (см. docs/banner-design.md) |
| Адаптивный баннер | Нет — один фиксированный размер |

## Открытые вопросы (обсудить позже)

1. **AI-безопасность:** Sandboxing для tool execution?
2. **Desktop:** Electron vs Tauri (когда дойдём)?
3. ~~Адаптивный баннер~~ — нет, фиксированный размер.

## Ресурсы

- [docs/banner-design.md](docs/banner-design.md) — финальный баннер
- [docs/color-palettes.md](docs/color-palettes.md) — 4 темы для onboarding
