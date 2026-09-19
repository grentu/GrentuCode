// Core domain types for the GrentuCode orchestrator (architecture v4).
//
// The whole system is a hierarchy, not a crowd: one orchestrator owns the plan
// and the frozen contract, roles work under it, and a human is the single
// escalation sink when the automatic machinery runs out of budget.

/** A task as it arrives from the user. */
export interface Task {
  readonly id: string;
  readonly description: string;
}

/**
 * A single clause of the frozen interface contract. Authors code against these
 * and never edit them — only the orchestrator writes the contract.
 */
export interface ContractClause {
  readonly id: string;
  /** Human-readable description of the guarantee this clause makes. */
  readonly description: string;
  /** Optional signature / shape the clause pins down (e.g. a function type). */
  readonly signature?: string;
}

/** The frozen contract. Single-writer: only the orchestrator mutates it. */
export interface Contract {
  readonly id: string;
  readonly clauses: readonly ContractClause[];
}

/**
 * A unit of work assigned to one author. File ownership is exclusive: no two
 * chunks share a file, so integration never hits a merge conflict on code —
 * only the contract can force a re-slice.
 */
export interface Chunk {
  readonly id: string;
  readonly description: string;
  /** Files this chunk exclusively owns. */
  readonly ownedFiles: readonly string[];
  /** Contract clauses this chunk must satisfy. */
  readonly clauseIds: readonly string[];
}

/** A decomposition produced by the orchestrator and reviewed by the plan-critic. */
export interface Plan {
  readonly contract: Contract;
  readonly chunks: readonly Chunk[];
}

/** What an author produces for a chunk: edits confined to its owned files. */
export interface ChunkResult {
  readonly chunkId: string;
  readonly files: Readonly<Record<string, string>>;
}

/**
 * A single test outcome after integration. `fingerprint` identifies the test by
 * *what it asserts* (contract clause + input), not by name — so a replan that
 * renames the test does not reset the same-test counter.
 */
export interface TestResult {
  readonly clauseId: string;
  readonly input: string;
  readonly passed: boolean;
  readonly fingerprint: string;
  /** Set when the test is a seam/contract test vs a within-chunk logic test. */
  readonly kind: "contract" | "logic";
}

/** How a failure is classified, which decides where the retry is routed. */
export type FailureKind = "contract" | "implementation";

/** A generic reviewer verdict (plan-critic, logic-critic). */
export interface Verdict {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * The acceptance gate's verdict. A rejection MUST carry a concrete failing test,
 * otherwise it does not count — this is what keeps a semantic-agent reviewer from
 * rejecting on vibes forever.
 */
export interface AcceptanceVerdict {
  readonly accepted: boolean;
  readonly reason?: string;
  /** Required when `accepted` is false: the defect expressed as a failing test. */
  readonly failingTest?: TestResult;
}

/** Reasons the loop hands control to a human — the single escalation sink. */
export type EscalationReason =
  | "replan-budget-exhausted"
  | "author-retry-budget-exhausted"
  | "acceptance-budget-exhausted"
  | "acceptance-reject-not-grounded"
  | "same-test-stuck"
  | "acceptance-conflict";

export interface Escalation {
  readonly reason: EscalationReason;
  /** Everything a human needs to pick up: what was tried, what still fails. */
  readonly context: string;
}

/** Structured trace of the run so the CLI and tests can assert transitions. */
export interface RunEvent {
  readonly type: string;
  readonly detail: string;
}

export type RunStatus = "delivered" | "escalated";

export interface RunResult {
  readonly status: RunStatus;
  readonly events: readonly RunEvent[];
  readonly escalation?: Escalation;
  /** Final integrated files when delivered. */
  readonly output?: Readonly<Record<string, string>>;
}

/** Budgets that bound every retry loop. Exhausting any of them escalates. */
export interface Budgets {
  /** Max author retries per chunk. */
  readonly K: number;
  /** Max full replans by the orchestrator. */
  readonly M: number;
  /** Max acceptance rejections per delivery. */
  readonly P: number;
  /** Same-fingerprint failures before we stop trusting the classifier. */
  readonly sameTestThreshold: number;
}

export const DEFAULT_BUDGETS: Budgets = {
  K: 3,
  M: 2,
  P: 3,
  sameTestThreshold: 2,
};
