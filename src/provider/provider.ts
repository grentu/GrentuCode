import type {
  AcceptanceVerdict,
  Chunk,
  ChunkResult,
  Contract,
  FailureKind,
  Plan,
  Task,
  TestResult,
  Verdict,
} from "../types.js";

/**
 * The single boundary between the orchestrator's control flow and the actual
 * models. Every role (orchestrator-as-planner, plan-critic, author, logic-critic,
 * integrator, classifier, acceptance) is one method here. Swap the mock for a
 * real Anthropic-backed implementation without touching the state machine.
 */
export interface AgentProvider {
  /** Orchestrator role: slice the task and freeze a contract. */
  plan(task: Task, attempt: number): Promise<Plan>;

  /** Plan-critic: review the decomposition before any code is written. */
  reviewPlan(plan: Plan): Promise<Verdict>;

  /** Author: implement one chunk against the frozen contract. */
  writeChunk(chunk: Chunk, contract: Contract, attempt: number): Promise<ChunkResult>;

  /** Logic-critic: adversarial review of a chunk's logic (pre-integration). */
  reviewLogic(chunk: Chunk, result: ChunkResult): Promise<Verdict>;

  /** Integrator: stitch worktrees and run contract + logic tests. */
  integrate(results: readonly ChunkResult[], contract: Contract): Promise<TestResult[]>;

  /** Classifier: is a failing test the plan's fault or the implementation's? */
  classifyFailure(failing: TestResult): Promise<FailureKind>;

  /** Acceptance gate: green tests are not "the right thing". Last semantic filter. */
  accept(
    results: readonly ChunkResult[],
    task: Task,
    contract: Contract,
  ): Promise<AcceptanceVerdict>;
}
