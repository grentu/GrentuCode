import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ChatMessage } from "../types";

const SESSIONS_DIR = path.join(os.homedir(), ".grentu", "sessions");

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messageCount: number;
}

export interface SessionData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
}

function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o700 });
  }
}

function getSessionPath(id: string): string {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

export function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${date}_${time}_${rand}`;
}

export function saveSession(data: SessionData): void {
  ensureSessionsDir();
  const updated = { ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(getSessionPath(data.id), JSON.stringify(updated, null, 2), "utf-8");
  fs.chmodSync(getSessionPath(data.id), 0o600);
}

export function loadSession(id: string): SessionData | null {
  const filePath = getSessionPath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function listSessions(): SessionMeta[] {
  ensureSessionsDir();
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  const sessions: SessionMeta[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), "utf-8");
      const data = JSON.parse(raw) as SessionData;
      sessions.push({
        id: data.id,
        title: data.title,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        provider: data.provider,
        model: data.model,
        messageCount: data.messages.length,
      });
    } catch {
      continue;
    }
  }
  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteSession(id: string): boolean {
  const filePath = getSessionPath(id);
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function exportSessionMarkdown(id: string): string | null {
  const session = loadSession(id);
  if (!session) return null;

  const lines: string[] = [
    `# ${session.title}`,
    "",
    `**Session ID:** ${session.id}`,
    `**Provider:** ${session.provider}`,
    `**Model:** ${session.model}`,
    `**Created:** ${session.createdAt}`,
    `**Updated:** ${session.updatedAt}`,
    "",
    "---",
    "",
  ];

  for (const msg of session.messages) {
    if (msg.role === "system") continue;
    if (msg.role === "tool") continue;

    const label = msg.role === "user" ? "## You" : "## Grentu";
    lines.push(label);
    lines.push("");
    lines.push(msg.content || "*(empty)*");

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        lines.push("");
        lines.push(`**Tool: ${tc.name}**`);
        const argsStr = Object.entries(tc.args)
          .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join(" ");
        lines.push(`> ${argsStr}`);
        if (tc.result) lines.push(`> Result: ${tc.result.slice(0, 200)}`);
        if (tc.error) lines.push(`> Error: ${tc.error}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

export { SESSIONS_DIR };
