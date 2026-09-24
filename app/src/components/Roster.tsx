import type { AgentGroup, AgentStatus, AgentVM } from "../types.js";

function Indicator({ status }: { status: AgentStatus }) {
  if (status === "typing") {
    return (
      <div className="ind typing">
        <i />
        <i />
        <i />
      </div>
    );
  }
  return (
    <div className={`ind ${status}`}>
      <i />
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentVM }) {
  return (
    <div className="agent">
      <div className="avatar">{agent.avatar}</div>
      <div className="meta">
        <b>{agent.name}</b>
        <span>{agent.role}</span>
      </div>
      <Indicator status={agent.status} />
    </div>
  );
}

const GROUPS: { key: AgentGroup; label: string }[] = [
  { key: "lead", label: "ВЕДУЩИЕ" },
  { key: "pair1", label: "ПАРА 1 · модуль foo" },
  { key: "pair2", label: "ПАРА 2 · модуль bar" },
];

export function Roster({ agents }: { agents: AgentVM[] }) {
  return (
    <div className="rail-left">
      <div className="head">
        <b>Агенты</b>
        <span>ростер</span>
      </div>

      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="group-label">{g.label}</div>
          {agents
            .filter((a) => a.group === g.key)
            .map((a) => (
              <AgentRow key={a.id} agent={a} />
            ))}
        </div>
      ))}

      <div className="legend">
        <b>ИНДИКАТОРЫ</b>
        <div className="row">
          <Indicator status="active" />
          активен, ведёт
        </div>
        <div className="row">
          <Indicator status="typing" />
          печатает
        </div>
        <div className="row">
          <Indicator status="idle" />
          ждёт
        </div>
      </div>

      <div className="add-agent">+ добавить агента</div>
    </div>
  );
}
