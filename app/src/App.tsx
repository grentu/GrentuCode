import { useState } from "react";
import { TopBar } from "./components/TopBar.js";
import { Roster } from "./components/Roster.js";
import { Chat } from "./components/Chat.js";
import { WorkPanel } from "./components/WorkPanel.js";
import { mockRun } from "./mock.js";

type Tab = "agents" | "chat" | "work";

export function App() {
  // The run-state is mock for now; the Electron preload exposes `window.grentu`
  // to stream live orchestrator state here once the core is wired into main.
  const run = mockRun;
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="app">
      <TopBar agentCount={run.agents.length} />
      <div className="body" data-tab={tab}>
        <Roster agents={run.agents} />
        <Chat
          task={run.task}
          subtitle={run.subtitle}
          messages={run.messages}
          consultation={run.consultation}
        />
        <WorkPanel run={run} />
      </div>
      <nav className="tabbar">
        {(["agents", "chat", "work"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "agents" ? "Агенты" : t === "chat" ? "Чат" : "Работа"}
          </button>
        ))}
      </nav>
    </div>
  );
}
