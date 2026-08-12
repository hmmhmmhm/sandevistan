import { describe, expect, it } from "vitest";
import { addXUsage, summarizeXUsage } from "./x-usage";

describe("X usage ledger", () => {
  it("deduplicates resources within the X UTC billing day", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    const first = addXUsage([], { postIds: ["post-1", "post-2"], userIds: ["me"] }, now);
    const ledger = addXUsage(first, { postIds: ["post-2", "post-3"], userIds: ["me"] }, now);

    expect(summarizeXUsage(ledger, now).today).toEqual({
      posts: 3,
      users: 1,
      usd: 0.025,
    });
  });

  it("separates the previous UTC month", () => {
    const ledger = addXUsage([], { postIds: ["july"], userIds: [] }, new Date("2026-07-31T12:00:00.000Z"));
    const next = addXUsage(ledger, { postIds: ["august"], userIds: [] }, new Date("2026-08-01T12:00:00.000Z"));
    const summary = summarizeXUsage(next, new Date("2026-08-12T12:00:00.000Z"));

    expect(summary.month.posts).toBe(1);
    expect(summary.lastMonth.posts).toBe(1);
  });
});
