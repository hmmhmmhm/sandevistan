import { expect, it, vi } from "vitest";
import { createAiRuntime } from "./ai-runtime";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";
import type { AiRealtimeSessionOptions } from "./ai-realtime-session-types";

function harness() {
  let snapshot = createAiHudSnapshot(true);
  let callbacks: AiRealtimeSessionOptions | undefined;
  let finishStart = () => {};
  const pending = new Promise<void>((resolve) => { finishStart = resolve; });
  const createSession = vi.fn((options: AiRealtimeSessionOptions) => {
    callbacks = options;
    return { start: () => pending, stop: async () => createRealtimeProtocolState(),
      getState: () => createRealtimeProtocolState(), cancelResponse: () => createRealtimeProtocolState() };
  });
  const runtime = createAiRuntime({
    bridge: { audioControl: async () => true, onEvenHubEvent: () => () => {},
      getLocalStorage: async () => "", setLocalStorage: async () => true },
    getKey: () => "sk-test-1234567890abcdefghijklmnop", getLocale: () => "ko",
    getSnapshot: () => snapshot, onSnapshot: (next) => { snapshot = next; },
    refresh: async () => {}, createSession,
  });
  return { runtime, createSession, finishStart, callbacks: () => callbacks, snapshot: () => snapshot };
}

it("does not create a session when exit occurs while loading settings", async () => {
  const h = harness();
  const starting = h.runtime.start();
  await h.runtime.stop();
  h.finishStart();
  expect(await starting).toBe(false);
  expect(h.createSession).not.toHaveBeenCalled();
  h.runtime.dispose();
});

it("rejects late startup success and ignores callbacks after exit", async () => {
  const h = harness();
  const starting = h.runtime.start();
  await vi.waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  await h.runtime.stop();
  h.finishStart();
  expect(await starting).toBe(false);
  h.callbacks()?.onState?.({ ...createRealtimeProtocolState(), phase: "error", error: "Late event" });
  expect(h.snapshot().phase).toBe("idle");
  expect(h.snapshot().error).toBeUndefined();
  h.runtime.dispose();
});

it("presents the received answer as one batch instead of a character backlog", async () => {
  const h = harness();
  const starting = h.runtime.start();
  await vi.waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  h.finishStart(); await starting;
  vi.useFakeTimers();
  try {
    const answer = "A complete readable answer appears together.";
    h.callbacks()?.onState?.({ ...createRealtimeProtocolState(), phase: "thinking", assistantText: answer });
    await vi.advanceTimersByTimeAsync(250);
    expect(h.snapshot().assistantText).toBe(answer);
  } finally { h.runtime.dispose(); vi.useRealTimers(); }
});

it("clears the active indicator synchronously when leaving a thinking session", async () => {
  const h = harness(); const starting = h.runtime.start();
  await vi.waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  h.finishStart(); await starting;
  h.callbacks()?.onState?.({ ...createRealtimeProtocolState(), phase: "thinking", userText: "Question" });
  expect(h.snapshot().phase).toBe("thinking");
  const stopping = h.runtime.stop();
  expect(h.snapshot().phase).toBe("idle");
  expect(h.snapshot().activeTool).toBeUndefined();
  await stopping; h.runtime.dispose();
});
