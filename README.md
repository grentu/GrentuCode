# GrentuCode

Multi-agent coding orchestrator. A desktop-class coding agent (in the family of
Codex / Claude Code / OpenCode), but instead of one model in a chat, a *hierarchy*
of neural nets plans, writes, reviews and accepts code — under budget, with a
human as the single safety sink.

The guiding principle is **hierarchy, not a crowd.** Six equal models talking over
each other rarely beats one strong model; the win comes from *roles* (author,
critic, tester) under one orchestrator that owns the plan and holds the final say.

## Architecture (v4)

```
user → orchestrator → plan-critic → authors (own worktrees) → logic-critic
     → integration + contract tests → failure classifier → acceptance gate → user
```

- **Orchestrator** — slices the task, freezes an interface contract, holds the plan.
  Single-writer of the contract, so authors never fight over shared files.
- **Plan-critic** — reviews the decomposition *before* any code is written. A bad
  slice is caught here, cheaply, instead of after expensive work.
- **Authors** — each implements one chunk in its own git worktree over an exclusive
  set of files. They code against the frozen contract and never edit it.
- **Logic-critic** — adversarial review of a chunk's *logic*, pre-integration.
  Deliberately a separate layer from integration, not the final filter.
- **Integration + contract tests** — stitches the worktrees and runs the seam tests
  that were written up front, so signature/interface mismatches surface as concrete
  failing tests.
- **Failure classifier** — routes each failure: *contract* faults trigger a replan,
  *implementation* faults go back to the owning author. It is not the final word —
  see budgets below.
- **Acceptance gate** — green tests are not "the right thing". A human or semantic
  agent is the last filter of meaning. A rejection must be expressed as a concrete
  failing test, otherwise it does not count.

### Safety: budgets + a single escalation sink

Every loop is bounded. No loop can spin forever.

| Budget | Bounds | On exhaustion |
| --- | --- | --- |
| `K` | author retries per chunk | escalate to human |
| `M` | full replans | escalate to human |
| `P` | acceptance rejections per delivery | escalate to human |
| `sameTestThreshold` | same-fingerprint failures before the classifier is overridden | force replan, then escalate |

Two details that close the subtle holes:

- **Test identity is a fingerprint** of `(contract clause + input)`, not the test
  name. A replan can rename or re-file a test; the "same test failed N times"
  counter still recognises it and stops trusting the classifier.
- **Acceptance has its own budget.** A grounded rejection under budget becomes a
  new failing test and sends the owning chunk back to its author (the suite gets
  stricter). Past `P`, or a rejection that can't be expressed as a test, escalates.

All dead ends funnel to one place — **escalation to a human** — carrying what was
tried and what still fails.

## Status

This is **v0**: the control loop is real and fully tested against a deterministic
mock provider, so the state machine (budgets, routing, fingerprints, escalation)
is exercised without spending tokens. The model calls live behind one interface
(`AgentProvider`); a real Anthropic-backed provider, git-worktree execution, and
actual test running are the next increments.

## Layout

```
src/
  types.ts            domain types (Task, Contract, Chunk, budgets, verdicts)
  orchestrator.ts     the v4 control loop / state machine
  budgets.ts          per-scope counters (K / M / P / same-test)
  fingerprint.ts      stable test identity (clause + input)
  provider/
    provider.ts       AgentProvider interface — the model boundary
    mock.ts           deterministic mock + scenario hooks
  cli.ts              grentu demo — runs a task and prints the state trace
test/                 vitest suite, one branch per v4 path
```

## Develop

```bash
npm install
npm test          # vitest, deterministic
npm run typecheck
npm run demo      # happy path with one auto-fixed failure
npx tsx src/cli.ts demo escalate   # the escalation path
```

## Roadmap

1. Real `AgentProvider` backed by the Anthropic API (behind the same interface).
2. Author execution in real git worktrees with actual file writes.
3. Real test runner for the integration + contract stage.
4. Persisted run state (`spec.md`, per-agent `progress.*.md`) as designed.
5. The "messenger" UX: multiple agents in a chat, consultation kept internal,
   one result surfaced to the user.
