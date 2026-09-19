import { describe, expect, it } from "vitest";
import { BudgetTracker } from "../src/budgets.js";

describe("BudgetTracker", () => {
  it("counts up from zero per key", () => {
    const t = new BudgetTracker();
    expect(t.get("k")).toBe(0);
    expect(t.bump("k")).toBe(1);
    expect(t.bump("k")).toBe(2);
    expect(t.get("k")).toBe(2);
  });

  it("keeps keys independent", () => {
    const t = new BudgetTracker();
    t.bump("a");
    expect(t.get("b")).toBe(0);
  });

  it("atOrOver fires at the limit", () => {
    const t = new BudgetTracker();
    t.bump("k");
    t.bump("k");
    expect(t.atOrOver("k", 3)).toBe(false);
    t.bump("k");
    expect(t.atOrOver("k", 3)).toBe(true);
  });

  it("reset forgets a scope", () => {
    const t = new BudgetTracker();
    t.bump("k");
    t.reset("k");
    expect(t.get("k")).toBe(0);
  });
});
