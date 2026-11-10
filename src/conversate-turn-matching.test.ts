import { describe, expect, it, vi } from "vitest";
import { createConversateTurnMatcher } from "./conversate-turn-matching";

describe("Conversate paired transcription turns", () => {
  it("matches by committed input even when both streams complete out of order", () => {
    const refined = vi.fn();
    const matcher = createConversateTurnMatcher(refined);
    matcher.commit();
    matcher.commit();
    matcher.acknowledge("live", "live-1");
    matcher.acknowledge("live", "live-2");
    matcher.acknowledge("refinement", "ref-1");
    matcher.acknowledge("refinement", "ref-2");
    matcher.complete("live", "live-2", "second live");
    matcher.complete("refinement", "ref-1", "first corrected");
    expect(refined).not.toHaveBeenCalled();
    matcher.complete("live", "live-1", "first live");
    matcher.complete("refinement", "ref-2", "second corrected");
    expect(refined.mock.calls).toEqual([
      ["live-1", "first corrected"], ["live-2", "second corrected"],
    ]);
  });

  it("does not attach an unacknowledged or duplicate result to a different turn", () => {
    const refined = vi.fn();
    const matcher = createConversateTurnMatcher(refined);
    matcher.commit();
    matcher.acknowledge("live", "one");
    matcher.acknowledge("refinement", "ref-one");
    matcher.complete("live", "one", "hello");
    matcher.complete("refinement", "unknown", "wrong");
    matcher.complete("refinement", "ref-one", "correct");
    matcher.complete("refinement", "ref-one", "duplicate");
    expect(refined.mock.calls).toEqual([["one", "correct"]]);
  });
});
