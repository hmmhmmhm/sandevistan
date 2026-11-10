import { expect, it, vi } from "vitest";
import { requestRealtimeClientSecret } from "./ai-realtime-token";

it("times out a stalled client-secret request without requiring a tap to cancel", async () => {
  vi.useFakeTimers();
  const parent = new AbortController();
  let outcome: string | undefined;
  const pending = requestRealtimeClientSecret({
    key: "sk-test-1234567890abcdefghijklmnop", signal: parent.signal,
    fetchImpl: (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  }).then(() => { outcome = "resolved"; }, (error: Error) => { outcome = error.message; });
  try {
    await vi.advanceTimersByTimeAsync(10_000);
    expect(outcome).toBe("Realtime session timed out");
  } finally {
    parent.abort();
    await pending;
    vi.useRealTimers();
  }
});
