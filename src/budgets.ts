/**
 * Counters for every bounded loop in the orchestrator. Keys are scoped strings
 * (e.g. `author:chunk-1`, `replan`, `accept:chunk-1`, `fp:<fingerprint>`), so
 * one tracker holds all of K/M/P plus the per-fingerprint "same test" tally.
 *
 * The tracker only counts and compares. The decision to escalate lives in the
 * orchestrator, which owns the Budgets limits.
 */
export class BudgetTracker {
  private readonly counts = new Map<string, number>();

  /** Increment a counter and return its new value. */
  bump(key: string): number {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  get(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  /** True once the counter has reached the limit. */
  atOrOver(key: string, limit: number): boolean {
    return this.get(key) >= limit;
  }

  /** Forget a scope (e.g. a chunk that finally went green). */
  reset(key: string): void {
    this.counts.delete(key);
  }
}
