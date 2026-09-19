import { Orchestrator } from "./orchestrator.js";
import { MockProvider, failingTest, passingTest } from "./provider/mock.js";
import type { Task } from "./types.js";

/**
 * Tiny CLI so the control loop is runnable, not just testable. `grentu demo`
 * drives a task through the orchestrator with the mock provider and prints the
 * state trace. `grentu demo escalate` shows the human-escalation path.
 */
async function main(): Promise<void> {
  const [cmd, variant] = process.argv.slice(2);

  if (cmd !== "demo") {
    console.log("GrentuCode — multi-agent coding orchestrator (v0)");
    console.log("usage: grentu demo [escalate]");
    return;
  }

  const task: Task = {
    id: "task-1",
    description: "add a 'foo' and 'bar' module and wire them together",
  };

  const provider =
    variant === "escalate"
      ? // A chunk that never passes its logic review -> author retry budget blows.
        new MockProvider({ reviewLogic: () => ({ ok: false, reason: "logic still wrong" }) })
      : // Happy path with one implementation-level failure that the author fixes.
        new MockProvider(oneFixableFailure());

  const orchestrator = new Orchestrator(provider, { K: 3, M: 2, P: 3, sameTestThreshold: 2 });
  const result = await orchestrator.run(task);

  console.log(`\n=== run: ${result.status.toUpperCase()} ===`);
  for (const e of result.events) console.log(`  [${e.type}] ${e.detail}`);
  if (result.status === "escalated" && result.escalation) {
    console.log(`\n! escalated to human: ${result.escalation.reason}`);
    console.log(`  ${result.escalation.context}`);
  }
  if (result.status === "delivered" && result.output) {
    console.log(`\ndelivered files: ${Object.keys(result.output).join(", ")}`);
  }
}

/** Scenario: clause-b fails once (implementation), then the author fixes it. */
function oneFixableFailure(): ConstructorParameters<typeof MockProvider>[0] {
  let integrations = 0;
  return {
    integrate: (_results, contract) => {
      integrations += 1;
      return contract.clauses.map((c) =>
        c.id === "clause-b" && integrations === 1 ? failingTest(c.id) : passingTest(c.id),
      );
    },
    classifyFailure: () => "implementation",
  };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
