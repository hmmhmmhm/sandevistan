import { describe, expect, it, vi } from "vitest";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import { createConversateRuntime } from "./conversate-runtime";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  type ConversateSnapshot,
} from "./conversate-state";

describe("Conversate live presentation state", () => {
  it("follows new speech, browses transcript history, and clears stale Copilot choices", async () => {
    let snapshot: ConversateSnapshot = createConversateSnapshot();
    let sessionOptions: Parameters<typeof createConversateRealtimeSession>[0] | undefined;
    const createSession: typeof createConversateRealtimeSession = (options) => {
      sessionOptions = options;
      return { start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
    };
    const refresh = vi.fn();
    const runtime = createConversateRuntime({
      bridge: {
        audioControl: vi.fn(async () => true),
        onEvenHubEvent: vi.fn(() => () => undefined),
        getLocalStorage: vi.fn(async () => ""),
        setLocalStorage: vi.fn(async () => true),
      },
      getKey: () => "sk-test-1234567890abcdefghijklmnop",
      getLocale: () => "ko",
      getSettings: () => ({
        ...DEFAULT_CONVERSATE_SETTINGS,
        translation: false, inform: false, copilot: false,
      }),
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh,
      createSession,
    });
    await runtime.start();
    sessionOptions?.onCompleted("one", "First turn");
    sessionOptions?.onCompleted("two", "Latest turn");
    runtime.scroll(-1);
    expect(snapshot.transcriptOffset).toBe(1);
    runtime.scroll(1);
    expect(snapshot.transcriptOffset).toBe(0);

    snapshot = {
      ...snapshot,
      suggestions: [
        { style: "direct", original: "One", pronunciation: "one", meaning: "하나" },
        { style: "warm", original: "Two", pronunciation: "two", meaning: "둘" },
      ],
    };
    runtime.tap();
    runtime.scroll(1);
    expect(snapshot).toMatchObject({ copilotOpen: true, selectedSuggestion: 1 });
    sessionOptions?.onPartial("three", "New topic");
    expect(snapshot).toMatchObject({ copilotOpen: false, suggestions: [] });
    expect(snapshot.partial).toBe("New topic");
    expect(refresh.mock.calls.map(([priority]) => priority)).toContain("input");
    expect(refresh.mock.calls.map(([priority]) => priority)).toContain("transcript");
    runtime.dispose();
  });
});
