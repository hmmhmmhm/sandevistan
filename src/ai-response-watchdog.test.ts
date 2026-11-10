import { expect, it, vi } from "vitest";
import { createAiResponseWatchdog } from "./ai-response-watchdog";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";

it("renews only on progress and clears when a response completes", async () => {
  vi.useFakeTimers();
  const expired = vi.fn(); const watch = createAiResponseWatchdog(expired);
  const thinking = { ...createRealtimeProtocolState(), phase: "thinking" as const };
  try {
    watch.observe(thinking);
    await vi.advanceTimersByTimeAsync(15_000);
    watch.observe({ ...thinking, assistantText: "Progress" });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(expired).not.toHaveBeenCalled();
    watch.observe({ ...thinking, phase: "listening" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(expired).not.toHaveBeenCalled();
  } finally { watch.clear(); vi.useRealTimers(); }
});
it("does not expire while waiting for the owner's MCP approval", async () => {
  vi.useFakeTimers(); const expired = vi.fn(); const watch = createAiResponseWatchdog(expired);
  try {
    watch.observe({ ...createRealtimeProtocolState(), phase: "thinking", pendingApproval: {
      id: "one", serverLabel: "Docs", serverName: "Docs", toolName: "search", argumentsSummary: "query",
    } });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(expired).not.toHaveBeenCalled();
  } finally { watch.clear(); vi.useRealTimers(); }
});
