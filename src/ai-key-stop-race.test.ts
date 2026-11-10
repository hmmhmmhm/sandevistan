import { expect, it, vi } from "vitest";
import { createAiRuntime } from "./ai-runtime";
import { createConversateRuntime } from "./conversate-runtime";
import { createAiKeyLifecycle } from "./ai-key-lifecycle";
import { createAiHudSnapshot } from "./ai-hud-state";
import { createRealtimeProtocolState } from "./ai-realtime-protocol";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } from "./conversate-state";
import type { FastHudViewMode } from "./fast-hud-view";

it.each(["ai", "conversate"] as const)("awaits an earlier detail shutdown before restarting %s with a new key", async selected => {
  let release = () => {};
  const closing = new Promise<void>(resolve => { release = resolve; });
  let key = "old", mode: FastHudViewMode = selected;
  let aiSnapshot = createAiHudSnapshot(true), conversateSnapshot = createConversateSnapshot();
  const bridge = {
    audioControl: vi.fn(async () => true), onEvenHubEvent: vi.fn(() => () => {}),
    getLocalStorage: vi.fn(async () => ""), setLocalStorage: vi.fn(async () => true),
  };
  const aiStart = vi.fn(async () => {}), conversateStart = vi.fn(async () => {});
  const protocol = createRealtimeProtocolState();
  const ai = createAiRuntime({
    bridge, getKey: () => key, getLocale: () => "en", getSnapshot: () => aiSnapshot,
    onSnapshot: value => { aiSnapshot = value; }, refresh: vi.fn(),
    createSession: () => ({ start: aiStart, stop: async () => { await closing; return protocol; },
      getState: () => protocol, cancelResponse: () => protocol }),
  });
  const conversate = createConversateRuntime({
    bridge, getKey: () => key, getLocale: () => "en", getSnapshot: () => conversateSnapshot,
    getSettings: () => ({ ...DEFAULT_CONVERSATE_SETTINGS, inform: false, copilot: false, translation: false }),
    onSnapshot: value => { conversateSnapshot = value; }, refresh: vi.fn(),
    createSession: () => ({ start: conversateStart, stop: () => closing }),
  });
  const lifecycle = createAiKeyLifecycle({ getKey: () => key, getMode: () => mode, ai, conversate, onError: vi.fn() });
  const runtime = selected === "ai" ? ai : conversate;
  const starts = selected === "ai" ? aiStart : conversateStart;
  try {
    await runtime.start();
    mode = "dashboard";
    const firstStop = runtime.stop();
    mode = selected;
    key = "new";
    lifecycle.changed();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(starts).toHaveBeenCalledTimes(1);
    release(); await firstStop;
    await vi.waitFor(() => expect(starts).toHaveBeenCalledTimes(2));
  } finally {
    release(); lifecycle.dispose(); ai.dispose(); conversate.dispose();
  }
});
