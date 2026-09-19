// UI view-model. Mirrors the state the orchestrator core exposes, shaped for
// rendering. Kept separate from the core's domain types so the UI can evolve
// without dragging the engine along.

export type AgentStatus = "active" | "typing" | "idle";
export type AgentGroup = "lead" | "pair1" | "pair2";

export interface AgentVM {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: AgentStatus;
  group: AgentGroup;
}

export interface MessageVM {
  id: string;
  authorKind: "user" | "agent";
  author: string;
  text: string;
  time: string;
}

export interface ConsultationVM {
  pairLabel: string;
  replies: { who: string; text: string }[];
}

export type ChunkState = "done" | "fixing" | "waiting";
export interface ChunkVM {
  id: string;
  label: string;
  owner: string;
  state: ChunkState;
}

export interface TestVM {
  id: string;
  label: string;
  passed: boolean;
}

export interface BudgetVM {
  key: string;
  label: string;
  used: number;
  max: number;
  emphasize: boolean;
}

export interface RunState {
  task: string;
  subtitle: string;
  agents: AgentVM[];
  messages: MessageVM[];
  consultation: ConsultationVM;
  plan: ChunkVM[];
  contract: {
    frozen: boolean;
    version: number;
    reslices: number;
    clauses: { id: string; signature: string }[];
  };
  tests: { passed: number; total: number; items: TestVM[] };
  budgets: BudgetVM[];
  status: { ok: boolean; title: string; detail: string };
}
