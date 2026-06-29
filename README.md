<div align="center">

```
  ██████  ██████  ███████ ███    ██ ████████ ██    ██
 ██       ██   ██ ██      ████   ██    ██    ██    ██
 ██   ███ ██████  █████   ██ ██  ██    ██    ██    ██
 ██    ██ ██   ██ ██      ██  ██ ██    ██    ██    ██
  ██████  ██   ██ ███████ ██   ████    ██     ██████
```

**AI coding agent for the terminal**

[![npm version](https://img.shields.io/npm/v/@grentu/grentu.svg)](https://www.npmjs.com/package/@grentu/grentu)
[![license](https://img.shields.io/npm/l/@grentu/grentu.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@grentu/grentu.svg)](https://nodejs.org)

</div>

---

Grentu Code — терминальный AI-ассистент для разработки. Полноценный аналог Claude Code, Codex CLI и Antigravity, работающий прямо в вашем терминале.

## ✨ Features

- 🎨 **4 цветовые темы** — выбери свою при первом запуске (Neon Forest, Sunset Terminal, Deep Space, Hacker Green)
- 💬 **Стриминг ответов** — потоковый вывод токенов от LLM в реальном времени
- ⌨️ **Slash-команды** — `/help`, `/clear`, `/model`, `/theme`, `/exit`
- 🔧 **Мульти-провайдер** — OpenAI, Anthropic, Google, локальные LLM (в разработке)
- 📝 **Onboarding** — настройка при первом запуске
- ⚡ **TypeScript + Ink** — быстрый, современный TUI на React

## 📦 Установка

```bash
npm install -g @grentu/grentu
```

## 🚀 Использование

```bash
# Установи API-ключ
export OPENAI_API_KEY=sk-...

# Запусти
grentu
```

При первом запуске Grentu предложит выбрать цветовую тему. После выбора откроется интерактивный чат с AI.

### Slash-команды

| Команда | Описание |
|---------|----------|
| `/help` | Список всех команд |
| `/clear` | Очистить историю чата |
| `/model` | Показать/сменить модель |
| `/theme` | Показать/сменить цветовую тему |
| `/exit` | Выход |

### Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Enter` | Отправить сообщение |
| `Ctrl+C` | Отменить стриминг / выйти |
| `Ctrl+D` | Выйти |

## 🛠️ Разработка

```bash
# Клонировать
git clone https://github.com/grentu/GrentuCode.git
cd GrentuCode

# Установить зависимости
npm install

# Сборка
npm run build

# Запуск
npm start

# Watch-режим для разработки
npm run dev
```

### Структура проекта

```
src/
├── index.ts               # Entry point + TTY-проверка
├── ui/
│   ├── App.tsx            # Главный компонент
│   ├── Banner.tsx         # ASCII-баннер
│   ├── Onboarding.tsx     # Выбор темы при первом запуске
│   ├── Input.tsx          # Строка ввода
│   ├── Messages.tsx       # История сообщений
│   ├── Spinner.tsx        # Индикатор загрузки
│   └── theme.ts           # Цветовые темы
├── providers/
│   ├── base.ts            # Интерфейс LLMProvider
│   └── openai.ts          # OpenAI-провайдер
├── commands/
│   └── registry.ts        # Slash-команды
└── config/
    └── index.ts           # ~/.grentu/config.json
```

## 🗺️ Roadmap

Смотри [ROADMAP.md](./ROADMAP.md) для полного плана разработки.

- [x] **M1** — TUI Foundation (баннер, ввод, стриминг, slash-команды)
- [ ] **M2** — Multi-Provider (Anthropic, Google, локальные LLM)
- [ ] **M3** — Agent Loop & Tools (files, terminal, search)
- [ ] **M4** — Sessions & Persistence
- [ ] **M5** — MCP & Extensions
- [ ] **M6** — Desktop Version
- [ ] **M7** — Polish & Release

## 📄 Лицензия

[MIT](./LICENSE)
