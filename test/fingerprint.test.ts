import { describe, expect, it } from "vitest";
import { testFingerprint } from "../src/fingerprint.js";

describe("testFingerprint", () => {
  it("is stable for the same clause + input", () => {
    expect(testFingerprint("clause-a", "in")).toBe(testFingerprint("clause-a", "in"));
  });

  it("depends on both clause and input, not test name", () => {
    expect(testFingerprint("clause-a", "in")).not.toBe(testFingerprint("clause-b", "in"));
    expect(testFingerprint("clause-a", "in")).not.toBe(testFingerprint("clause-a", "other"));
  });

  it("survives a rename: identity is clause+input, so a renamed test matches", () => {
    // Two "different" tests (as far as names go) that assert the same clause on
    // the same input share a fingerprint — the same-test counter won't reset.
    const beforeReplan = testFingerprint("clause-a", "vector-1");
    const afterReplan = testFingerprint("clause-a", "vector-1");
    expect(afterReplan).toBe(beforeReplan);
  });
});
