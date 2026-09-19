import { describe, expect, it } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";
import { MockProvider, failingTest, passingTest } from "../src/provider/mock.js";
import type { Task } from "../src/types.js";

const task: Task = { id: "t", description: "build foo and bar" };

function types(events: readonly { type: string }[]): string[] {
  return events.map((e) => e.type);
}

describe("Orchestrator — happy path", () => {
  it("delivers when everything is green", async () => {
    const r = await new Orchestrator(new MockProvider()).run(task);
    expect(r.status).toBe("delivered");
    expect(Object.keys(r.output ?? {}).sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(types(r.events)).toContain("accepted");
  });
});

describe("Orchestrator — plan-critic loop", () => {
  it("replans when the plan-critic rejects once, then delivers", async () => {
    let reviews = 0;
    const r = await new Orchestrator(
      new MockProvider({ reviewPlan: () => ({ ok: ++reviews > 1, reason: "bad slice" }) }),
    ).run(task);
    expect(r.status).toBe("delivered");
    expect(types(r.events)).toContain("plan-critic");
  });

  it("escalates when the plan-critic never accepts", async () => {
    const r = await new Orchestrator(
      new MockProvider({ reviewPlan: () => ({ ok: false, reason: "still bad" }) }),
      { M: 1 },
    ).run(task);
    expect(r.status).toBe("escalated");
    expect(r.escalation?.reason).toBe("replan-budget-exhausted");
  });
});

describe("Orchestrator — author + logic-critic", () => {
  it("escalates when a chunk never passes logic review", async () => {
    const r = await new Orchestrator(
      new MockProvider({ reviewLogic: () => ({ ok: false, reason: "wrong" }) }),
      { K: 2 },
    ).run(task);
    expect(r.status).toBe("escalated");
    expect(r.escalation?.reason).toBe("author-retry-budget-exhausted");
  });
});

describe("Orchestrator — failure routing", () => {
  it("retries the owning author on an implementation failure, then delivers", async () => {
    let integrations = 0;
    const r = await new Orchestrator(
      new MockProvider({
        integrate: (_res, contract) => {
          integrations += 1;
          return contract.clauses.map((c) =>
            c.id === "clause-b" && integrations === 1 ? failingTest(c.id) : passingTest(c.id),
          );
        },
        classifyFailure: () => "implementation",
      }),
    ).run(task);
    expect(r.status).toBe("delivered");
    expect(r.events.some((e) => e.type === "route" && e.detail.includes("implementation"))).toBe(true);
  });

  it("replans on a contract-level failure, then delivers", async () => {
    let integrations = 0;
    const r = await new Orchestrator(
      new MockProvider({
        integrate: (_res, contract) => {
          integrations += 1;
          return contract.clauses.map((c) =>
            c.id === "clause-a" && integrations === 1 ? failingTest(c.id) : passingTest(c.id),
          );
        },
        classifyFailure: () => "contract",
      }),
    ).run(task);
    expect(r.status).toBe("delivered");
    expect(r.events.some((e) => e.type === "route" && e.detail.includes("contract"))).toBe(true);
  });

  it("overrides the classifier and forces replan when the same test keeps failing", async () => {
    // Classifier insists 'implementation', but the same fingerprint keeps failing.
    const r = await new Orchestrator(
      new MockProvider({
        integrate: (_res, contract) => contract.clauses.map((c) =>
          c.id === "clause-a" ? failingTest(c.id) : passingTest(c.id),
        ),
        classifyFailure: () => "implementation",
      }),
      { M: 1, sameTestThreshold: 2 },
    ).run(task);
    expect(r.status).toBe("escalated");
    expect(r.escalation?.reason).toBe("same-test-stuck");
    expect(r.events.some((e) => e.detail.includes("classifier overridden"))).toBe(true);
  });
});

describe("Orchestrator — acceptance gate", () => {
  it("escalates when acceptance rejects without a grounding test", async () => {
    const r = await new Orchestrator(
      new MockProvider({ accept: () => ({ accepted: false, reason: "just not it" }) }),
    ).run(task);
    expect(r.status).toBe("escalated");
    expect(r.escalation?.reason).toBe("acceptance-reject-not-grounded");
  });

  it("converts a grounded rejection into a fix, then delivers", async () => {
    let accepts = 0;
    const r = await new Orchestrator(
      new MockProvider({
        accept: () =>
          ++accepts === 1
            ? { accepted: false, reason: "clause-a semantics off", failingTest: failingTest("clause-a") }
            : { accepted: true },
      }),
    ).run(task);
    expect(r.status).toBe("delivered");
    expect(types(r.events)).toContain("accept->fix");
  });

  it("escalates when acceptance keeps rejecting past its budget P", async () => {
    const r = await new Orchestrator(
      new MockProvider({
        accept: () => ({ accepted: false, reason: "never happy", failingTest: failingTest("clause-a") }),
      }),
      { P: 2 },
    ).run(task);
    expect(r.status).toBe("escalated");
    expect(r.escalation?.reason).toBe("acceptance-budget-exhausted");
  });
});
