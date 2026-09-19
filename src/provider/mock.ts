import { testFingerprint } from "../fingerprint.js";
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
import type { AgentProvider } from "./provider.js";

/**
 * Hooks let a test script any role's behaviour. Anything left undefined falls
 * back to a happy-path default (a two-chunk plan, clean reviews, all-green
 * tests, accepted). Hooks are plain functions, so a test can close over its own
 * counter to express "fail the first N times, then succeed".
 */
export interface MockConfig {
  plan?: (task: Task, attempt: number) => Plan;
  reviewPlan?: (plan: Plan) => Verdict;
  writeChunk?: (chunk: Chunk, contract: Contract, attempt: number) => ChunkResult;
  reviewLogic?: (chunk: Chunk, result: ChunkResult) => Verdict;
  integrate?: (results: readonly ChunkResult[], contract: Contract) => TestResult[];
  classifyFailure?: (failing: TestResult) => FailureKind;
  accept?: (results: readonly ChunkResult[], task: Task, contract: Contract) => AcceptanceVerdict;
}

/** A passing contract test for a clause, fingerprinted canonically. */
export function passingTest(clauseId: string): TestResult {
  const input = `${clauseId}#default`;
  return { clauseId, input, passed: true, fingerprint: testFingerprint(clauseId, input), kind: "contract" };
}

/** A failing contract test for a clause, fingerprinted canonically. */
export function failingTest(clauseId: string, kind: "contract" | "logic" = "contract"): TestResult {
  const input = `${clauseId}#default`;
  return { clauseId, input, passed: false, fingerprint: testFingerprint(clauseId, input), kind };
}

/** The default two-chunk plan used when a scenario does not supply its own. */
export function defaultPlan(): Plan {
  const contract: Contract = {
    id: "contract-1",
    clauses: [
      { id: "clause-a", description: "module A exposes foo()", signature: "foo(): string" },
      { id: "clause-b", description: "module B exposes bar()", signature: "bar(): number" },
    ],
  };
  const chunks: Chunk[] = [
    { id: "chunk-a", description: "implement module A", ownedFiles: ["src/a.ts"], clauseIds: ["clause-a"] },
    { id: "chunk-b", description: "implement module B", ownedFiles: ["src/b.ts"], clauseIds: ["clause-b"] },
  ];
  return { contract, chunks };
}

export class MockProvider implements AgentProvider {
  constructor(private readonly cfg: MockConfig = {}) {}

  async plan(task: Task, attempt: number): Promise<Plan> {
    return this.cfg.plan ? this.cfg.plan(task, attempt) : defaultPlan();
  }

  async reviewPlan(plan: Plan): Promise<Verdict> {
    return this.cfg.reviewPlan ? this.cfg.reviewPlan(plan) : { ok: true };
  }

  async writeChunk(chunk: Chunk, contract: Contract, attempt: number): Promise<ChunkResult> {
    if (this.cfg.writeChunk) return this.cfg.writeChunk(chunk, contract, attempt);
    const files: Record<string, string> = {};
    for (const f of chunk.ownedFiles) files[f] = `// ${chunk.id} impl (attempt ${attempt})\n`;
    return { chunkId: chunk.id, files };
  }

  async reviewLogic(chunk: Chunk, result: ChunkResult): Promise<Verdict> {
    return this.cfg.reviewLogic ? this.cfg.reviewLogic(chunk, result) : { ok: true };
  }

  async integrate(results: readonly ChunkResult[], contract: Contract): Promise<TestResult[]> {
    if (this.cfg.integrate) return this.cfg.integrate(results, contract);
    return contract.clauses.map((c) => passingTest(c.id));
  }

  async classifyFailure(failing: TestResult): Promise<FailureKind> {
    return this.cfg.classifyFailure ? this.cfg.classifyFailure(failing) : "implementation";
  }

  async accept(
    results: readonly ChunkResult[],
    task: Task,
    contract: Contract,
  ): Promise<AcceptanceVerdict> {
    return this.cfg.accept ? this.cfg.accept(results, task, contract) : { accepted: true };
  }
}
