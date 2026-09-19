import { BudgetTracker } from "./budgets.js";
import type { AgentProvider } from "./provider/provider.js";
import {
  DEFAULT_BUDGETS,
  type Budgets,
  type Chunk,
  type ChunkResult,
  type Contract,
  type Escalation,
  type EscalationReason,
  type Plan,
  type RunEvent,
  type RunResult,
  type Task,
  type TestResult,
} from "./types.js";

/**
 * The v4 control loop. Hierarchy, not a crowd: this class owns the plan and the
 * frozen contract, drives every role through the provider, and enforces the
 * budgets that keep any loop from spinning forever. A human is the single
 * escalation sink — every dead end funnels there with full context.
 */
export class Orchestrator {
  private readonly budgets: Budgets;
  private readonly tracker = new BudgetTracker();
  private readonly events: RunEvent[] = [];
  /** Hard backstop so a misbehaving provider can never hang the loop. */
  private readonly maxIterations = 50;

  constructor(
    private readonly provider: AgentProvider,
    budgets: Partial<Budgets> = {},
  ) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets };
  }

  async run(task: Task): Promise<RunResult> {
    this.log("task", task.description);

    let plan = await this.makePlan(task);
    if ("escalation" in plan) return this.escalate(plan.escalation);

    // Which chunks still need (re)running. Empty set on first pass = all chunks.
    let dirty = new Set<string>();
    let firstPass = true;
    const results = new Map<string, ChunkResult>();

    for (let i = 0; i < this.maxIterations; i++) {
      // --- Author + logic-critic phase --------------------------------------
      const toRun = firstPass
        ? plan.chunks
        : plan.chunks.filter((c) => dirty.has(c.id));
      firstPass = false;

      for (const chunk of toRun) {
        const authored = await this.authorChunk(chunk, plan.contract);
        if ("escalation" in authored) return this.escalate(authored.escalation);
        results.set(chunk.id, authored.result);
      }

      // --- Integration + tests ---------------------------------------------
      const ordered = plan.chunks
        .map((c) => results.get(c.id))
        .filter((r): r is ChunkResult => r !== undefined);
      const tests = await this.provider.integrate(ordered, plan.contract);
      const failing = tests.filter((t) => !t.passed);
      this.log("integrate", `${tests.length} tests, ${failing.length} failing`);

      if (failing.length > 0) {
        await this.classify(failing);
        const routed = this.routeFailures(failing, plan);
        if ("escalation" in routed) return this.escalate(routed.escalation);

        if (routed.action === "replan") {
          const replanned = await this.makePlan(task);
          if ("escalation" in replanned) return this.escalate(replanned.escalation);
          plan = replanned;
          results.clear();
          dirty = new Set();
          firstPass = true;
          continue;
        }

        // action === "retry-authors": re-run only the owning chunks
        dirty = routed.chunks;
        continue;
      }

      // --- Acceptance gate --------------------------------------------------
      const verdict = await this.provider.accept(ordered, task, plan.contract);
      if (verdict.accepted) {
        this.log("accepted", "delivered to user");
        return this.deliver(ordered);
      }

      // Rejection must be grounded as a concrete failing test, else it does not
      // count — this is what stops a semantic reviewer rejecting on vibes.
      if (!verdict.failingTest) {
        return this.escalate(
          this.mkEscalation(
            "acceptance-reject-not-grounded",
            `Acceptance rejected without a failing test: ${verdict.reason ?? "(no reason)"}`,
          ),
        );
      }

      const rejects = this.tracker.bump("accept");
      this.log("accept-reject", `P=${rejects}/${this.budgets.P}: ${verdict.reason ?? ""}`);
      if (this.tracker.atOrOver("accept", this.budgets.P)) {
        return this.escalate(
          this.mkEscalation(
            "acceptance-budget-exhausted",
            `Acceptance rejected ${rejects} times; last defect ${verdict.failingTest.fingerprint}. ` +
              `Tests are green but the reviewer keeps saying "not it" — a human must arbitrate.`,
          ),
        );
      }

      // Grounded reject under budget: the defect becomes a failing test and we
      // send the owning chunk back to its author. The suite is now stricter.
      const owner = this.ownerOf(verdict.failingTest.clauseId, plan);
      if (!owner) {
        return this.escalate(
          this.mkEscalation(
            "acceptance-reject-not-grounded",
            `Acceptance defect targets clause ${verdict.failingTest.clauseId} owned by no chunk.`,
          ),
        );
      }
      this.log("accept->fix", `defect ${verdict.failingTest.fingerprint} -> chunk ${owner.id}`);
      dirty = new Set([owner.id]);
    }

    return this.escalate(
      this.mkEscalation(
        "same-test-stuck",
        `Loop hit the ${this.maxIterations}-iteration backstop without converging.`,
      ),
    );
  }

  // --- phases ---------------------------------------------------------------

  private async makePlan(
    task: Task,
  ): Promise<Plan | { escalation: Escalation }> {
    for (;;) {
      const attempt = this.tracker.get("replan");
      const plan = await this.provider.plan(task, attempt);
      const verdict = await this.provider.reviewPlan(plan);
      if (verdict.ok) {
        this.log("plan", `${plan.chunks.length} chunks, ${plan.contract.clauses.length} clauses`);
        return plan;
      }
      this.log("plan-critic", `rejected: ${verdict.reason ?? ""}`);
      if (this.tracker.atOrOver("replan", this.budgets.M)) {
        return {
          escalation: this.mkEscalation(
            "replan-budget-exhausted",
            `Plan-critic rejected ${this.budgets.M} plans in a row: ${verdict.reason ?? ""}`,
          ),
        };
      }
      this.tracker.bump("replan");
    }
  }

  private async authorChunk(
    chunk: Chunk,
    contract: Contract,
  ): Promise<{ result: ChunkResult } | { escalation: Escalation }> {
    const key = `author:${chunk.id}`;
    for (;;) {
      const attempt = this.tracker.get(key);
      const result = await this.provider.writeChunk(chunk, contract, attempt);
      const verdict = await this.provider.reviewLogic(chunk, result);
      if (verdict.ok) {
        this.log("author", `chunk ${chunk.id} passed logic review`);
        return { result };
      }
      this.log("logic-critic", `chunk ${chunk.id} rejected: ${verdict.reason ?? ""}`);
      if (this.tracker.atOrOver(key, this.budgets.K)) {
        return {
          escalation: this.mkEscalation(
            "author-retry-budget-exhausted",
            `Author for chunk ${chunk.id} failed logic review ${this.budgets.K} times: ${verdict.reason ?? ""}`,
          ),
        };
      }
      this.tracker.bump(key);
    }
  }

  // --- failure routing ------------------------------------------------------

  private routeFailures(
    failing: readonly TestResult[],
    plan: Plan,
  ):
    | { action: "replan" }
    | { action: "retry-authors"; chunks: Set<string> }
    | { escalation: Escalation } {
    // Same-test override: if any failure's fingerprint has recurred past the
    // threshold, stop trusting the classifier and treat it as a contract fault.
    let sameStuck = false;
    for (const t of failing) {
      const n = this.tracker.bump(`fp:${t.fingerprint}`);
      if (n >= this.budgets.sameTestThreshold) sameStuck = true;
    }

    if (sameStuck) {
      if (this.tracker.atOrOver("replan", this.budgets.M)) {
        return {
          escalation: this.mkEscalation(
            "same-test-stuck",
            `A test kept failing across fixes and replans is exhausted. Human needed.`,
          ),
        };
      }
      this.tracker.bump("replan");
      this.log("route", "same-test-stuck -> forced replan (classifier overridden)");
      return { action: "replan" };
    }

    // Trust the classifier: any contract-level failure forces a replan; a purely
    // implementation-level batch routes back to the owning authors.
    const chunks = new Set<string>();
    let contractFault = false;
    for (const t of failing) {
      // classifyFailure is async but routing decisions are cheap to sequence;
      // we resolve them synchronously below via a pre-pass in the caller path.
      const kind = this.classificationCache.get(t.fingerprint);
      if (kind === "contract") contractFault = true;
      else {
        const owner = this.ownerOf(t.clauseId, plan);
        if (owner) chunks.add(owner.id);
      }
    }

    if (contractFault) {
      if (this.tracker.atOrOver("replan", this.budgets.M)) {
        return {
          escalation: this.mkEscalation(
            "replan-budget-exhausted",
            `Contract-level failure but replan budget of ${this.budgets.M} is spent. Human needed.`,
          ),
        };
      }
      this.tracker.bump("replan");
      this.log("route", "contract fault -> replan");
      return { action: "replan" };
    }

    for (const chunkId of chunks) {
      const key = `author:${chunkId}`;
      if (this.tracker.atOrOver(key, this.budgets.K)) {
        return {
          escalation: this.mkEscalation(
            "author-retry-budget-exhausted",
            `Chunk ${chunkId} failed integration past K=${this.budgets.K} retries. Human needed.`,
          ),
        };
      }
      this.tracker.bump(key);
    }
    this.log("route", `implementation fault -> retry chunks ${[...chunks].join(", ")}`);
    return { action: "retry-authors", chunks };
  }

  /**
   * Classifier results are fetched up front (async) and cached by fingerprint so
   * the synchronous routing pass above can read them without threading promises.
   */
  private readonly classificationCache = new Map<string, "contract" | "implementation">();

  private async classify(failing: readonly TestResult[]): Promise<void> {
    for (const t of failing) {
      if (!this.classificationCache.has(t.fingerprint)) {
        const kind = await this.provider.classifyFailure(t);
        this.classificationCache.set(t.fingerprint, kind);
      }
    }
  }

  // --- helpers --------------------------------------------------------------

  private ownerOf(clauseId: string, plan: Plan): Chunk | undefined {
    return plan.chunks.find((c) => c.clauseIds.includes(clauseId));
  }

  private log(type: string, detail: string): void {
    this.events.push({ type, detail });
  }

  private mkEscalation(reason: EscalationReason, context: string): Escalation {
    this.log("escalate", `${reason}: ${context}`);
    return { reason, context };
  }

  private escalate(escalation: Escalation): RunResult {
    return { status: "escalated", events: [...this.events], escalation };
  }

  private deliver(results: readonly ChunkResult[]): RunResult {
    const output: Record<string, string> = {};
    for (const r of results) Object.assign(output, r.files);
    return { status: "delivered", events: [...this.events], output };
  }
}
