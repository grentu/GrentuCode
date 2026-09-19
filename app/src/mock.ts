import type { RunState } from "./types.js";

// Mock run-state that mirrors the approved mono-v2 design: two pairs working in
// parallel, logic-b failed and being fixed within budget (K-b 1/3), no
// escalation. Swapped for live orchestrator state once the core is wired in.
export const mockRun: RunState = {
  task: "Задача: добавить модули foo и bar и связать их",
  subtitle: "оркестратор ведёт · 2 пары работают параллельно",
  agents: [
    { id: "orc", name: "Оркестратор", role: "планирует, режет задачу", avatar: "О", status: "active", group: "lead" },
    { id: "plan", name: "План-критик", role: "ревью нарезки", avatar: "П", status: "idle", group: "lead" },
    { id: "accept", name: "Приёмка", role: "последний фильтр смысла", avatar: "Пр", status: "idle", group: "lead" },
    { id: "a", name: "Автор A", role: "пишет src/foo.ts", avatar: "A", status: "typing", group: "pair1" },
    { id: "ka", name: "Логик-критик A", role: "совещается с A", avatar: "К", status: "typing", group: "pair1" },
    { id: "b", name: "Автор B", role: "правит после теста", avatar: "B", status: "typing", group: "pair2" },
    { id: "kb", name: "Логик-критик B", role: "ждёт код B", avatar: "К", status: "idle", group: "pair2" },
  ],
  messages: [
    { id: "m1", authorKind: "user", author: "Вы", text: "привет", time: "12:04" },
    { id: "m2", authorKind: "agent", author: "Оркестратор", text: "привет. готов принять задачу", time: "12:04" },
    { id: "m3", authorKind: "user", author: "Вы", text: "добавьте foo и bar и свяжите их", time: "12:05" },
    {
      id: "m4",
      authorKind: "agent",
      author: "Оркестратор",
      text: "режу на 2 куска. Пара 1 → foo, Пара 2 → bar. контракт заморожен, файлы не пересекаются",
      time: "12:05",
    },
  ],
  consultation: {
    pairLabel: "Пара 1 (внутри, юзеру виден итог)",
    replies: [
      { who: "К", text: "Логик-критик A: по foo верни строку, не число" },
      { who: "A", text: "Автор A: принял, правлю сигнатуру foo(): string" },
      { who: "A", text: "Автор A: готово, тесты стыка пройдены" },
    ],
  },
  plan: [
    { id: "chunk-a", label: "chunk-a · foo", owner: "Автор A", state: "done" },
    { id: "chunk-b", label: "chunk-b · bar", owner: "Автор B", state: "fixing" },
  ],
  contract: {
    frozen: true,
    version: 3,
    reslices: 2,
    clauses: [
      { id: "clause-a", signature: "foo(): string" },
      { id: "clause-b", signature: "bar(): number" },
    ],
  },
  tests: {
    passed: 3,
    total: 4,
    items: [
      { id: "contract-a", label: "contract-a · пройден", passed: true },
      { id: "contract-b", label: "contract-b · пройден", passed: true },
      { id: "logic-a", label: "logic-a · пройден", passed: true },
      { id: "logic-b", label: "logic-b · НЕ ПРОЙДЕН → ретрай Автора B", passed: false },
    ],
  },
  budgets: [
    { key: "K-a", label: "K-a · ретраи Автора A", used: 0, max: 3, emphasize: false },
    { key: "K-b", label: "K-b · ретраи Автора B", used: 1, max: 3, emphasize: true },
    { key: "M", label: "M · replan (общий)", used: 0, max: 2, emphasize: false },
    { key: "P", label: "P · приёмка (на поставку)", used: 0, max: 3, emphasize: false },
  ],
  status: {
    ok: true,
    title: "Чинится, в рамках бюджета",
    detail: "logic-b упал, Автор B правит (K-b 1/3). Эскалация не нужна.",
  },
};
