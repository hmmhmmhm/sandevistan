import { describe, expect, it, vi } from "vitest";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import { createConversateRuntime } from "./conversate-runtime";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  type ConversateSnapshot,
  type ConversateSettings,
} from "./conversate-state";

describe("Conversate live presentation state", () => {
  it("follows new speech, browses transcript history, and retains Copilot choices", async () => {
    let snapshot: ConversateSnapshot = createConversateSnapshot();
    let copilotEnabled = false;
    let sessionOptions: Parameters<typeof createConversateRealtimeSession>[0] | undefined;
    const createSession: typeof createConversateRealtimeSession = (options) => {
      sessionOptions = options;
      return { start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) };
    };
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
        translation: false, inform: false, copilot: copilotEnabled,
      }),
      getSnapshot: () => snapshot,
      onSnapshot: (next) => { snapshot = next; },
      refresh: vi.fn(),
      createSession,
    });
    await runtime.start();
    sessionOptions?.onCompleted("one", "First turn");
    sessionOptions?.onCompleted("two", "Latest turn");
    for (let i = 0; i < 4; i++) sessionOptions?.onCompleted(`extra${i}`, `Turn ${i}`);
    runtime.scroll(-1);
    expect(snapshot.transcriptOffset).toBe(1);
    runtime.scroll(1);
    expect(snapshot.transcriptOffset).toBe(0);

    copilotEnabled = true;
    snapshot = {
      ...snapshot,
      suggestions: [
        { style: "direct", original: "One", pronunciation: "one", meaning: "하나" },
        { style: "warm", original: "Two", pronunciation: "two", meaning: "둘" },
      ],
    };
    snapshot = { ...snapshot, copilotHistory: [{ id: "record", at: new Date().toISOString(), suggestions: snapshot.suggestions }] };
    runtime.tap(); runtime.tap();
    runtime.scroll(1);
    expect(snapshot.directory).toMatchObject({ mode: "copilot", suggestion: 1 });
    snapshot = { ...snapshot, activeInform: { id: "current-tip", text: "Useful context", at: new Date().toISOString() } };
    sessionOptions?.onPartial("three", "New topic");
    expect(snapshot.suggestions).toHaveLength(2);
    expect(snapshot.directory).toMatchObject({ mode: "copilot", suggestion: 1 });
    expect(snapshot.partial).toBe("New topic");
    expect(snapshot.activeInform?.text).toBe("Useful context");
    runtime.dispose();
  });
});

function runtimeHarness(startSession: () => Promise<void> = async () => undefined, analysis = false, settings: Partial<ConversateSettings> = {}) {
  let snapshot = createConversateSnapshot();
  let callbacks: Parameters<typeof createConversateRealtimeSession>[0] | undefined;
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
      translation: analysis, inform: analysis, copilot: analysis, ...settings,
    }),
    getSnapshot: () => snapshot,
    onSnapshot: (next) => { snapshot = next; },
    refresh: vi.fn(),
    createSession: (options) => {
      callbacks = options;
      return { start: startSession, stop: vi.fn(async () => undefined) };
    },
  });
  return { runtime, snapshot: () => snapshot, callbacks: () => callbacks, setSnapshot: (next: ConversateSnapshot) => { snapshot = next; } };
}

it("ignores late transcription callbacks after Conversate stops", async () => {
  const harness = runtimeHarness();
  await harness.runtime.start();
  harness.callbacks()?.onCompleted("one", "Saved turn");
  await harness.runtime.stop();
  harness.callbacks()?.onCompleted("late", "Late turn");
  harness.callbacks()?.onPartial("late", "Late partial");
  expect(harness.snapshot()).toMatchObject({ phase: "idle", partial: "" });
  expect(harness.snapshot().segments.map(({ text }) => text)).toEqual(["Saved turn"]);
  harness.runtime.dispose();
});

it("does not return to listening when startup completes after stop", async () => {
  let finishStart = () => {};
  const pending = new Promise<void>((resolve) => { finishStart = resolve; });
  const harness = runtimeHarness(() => pending);
  const starting = harness.runtime.start();
  await harness.runtime.stop();
  finishStart();
  expect(await starting).toBe(false);
  expect(harness.snapshot().phase).toBe("idle");
  harness.runtime.dispose();
});

it("keeps historical Inform open while new speech arrives", async () => {
  vi.useFakeTimers();
  const harness = runtimeHarness(undefined,false,{ inform:true });
  try {
    await harness.runtime.start();
    harness.setSnapshot({ ...harness.snapshot(), informs: [{ id: "one", text: "Tip", at: new Date().toISOString() }] });
    harness.runtime.tap();
    harness.runtime.tap();
    expect(harness.snapshot().directory?.mode).toBe("inform");
    await vi.advanceTimersByTimeAsync(1_000);
    harness.callbacks()?.onPartial("next", "Speech continues");
    await vi.advanceTimersByTimeAsync(DEFAULT_CONVERSATE_SETTINGS.informSeconds * 1_000);
    expect(harness.snapshot().directory?.mode).toBe("inform");
    expect(harness.snapshot().informs[0]?.text).toBe("Tip");
  } finally { harness.runtime.dispose(); vi.useRealTimers(); }
});

it("keeps the selected directory entry while a streamed Inform finishes", async () => {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.instructions.includes("Always return null for Inform")) {
      const json = JSON.stringify({ language: "en", translation: "안녕", inform: null, suggestions: [] });
      return new Response(`data: ${JSON.stringify({ type: "response.completed", response: { output: [{ content: [{ type: "output_text", text: json }] }] } })}\n\n`, { headers: { "content-type": "text/event-stream" } });
    }
    return new Response(stream, { headers: { "content-type": "text/event-stream" } });
  }));
  const harness = runtimeHarness(undefined, true);
  const emit = (event: unknown) => controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
  try {
    await harness.runtime.start();
    harness.callbacks()?.onCompleted("turn", "Hello");
    emit({ type: "response.output_text.delta", delta: '{"language":"en","translation":"안녕","inform":"Tip","suggestions":[' });
    await vi.waitFor(() => expect(harness.snapshot().activeInform?.text).toBe("Tip"));
    harness.runtime.tap();
    expect(harness.snapshot().directory?.mode).toBe("list");
    emit({ type: "response.completed", response: { output: [{ content: [{ type: "output_text", text: JSON.stringify({ language: "en", translation: "안녕", inform: "Tip", suggestions: [] }) }] }] } });
    controller?.close();
    await vi.waitFor(() => expect(harness.snapshot().informs).toHaveLength(1));
    expect(harness.snapshot().directory).toMatchObject({ mode: "list", selectedId: "turn-inform" });
  } finally { harness.runtime.dispose(); vi.unstubAllGlobals(); }
});

it("translates every completed turn while a previous analysis is still pending", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const text = JSON.parse(body.input.at(-1).content).currentUtterance;
    if (++calls === 1) await gate;
    const value = { language: "en", translation: `T:${text}`, inform: null, suggestions: [] };
    const json = JSON.stringify(value);
    return new Response(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: json })}\n\ndata: ${JSON.stringify({ type: "response.completed", response: { output: [{ content: [{ type: "output_text", text: json }] }] } })}\n\n`, { headers: { "content-type": "text/event-stream" } });
  }));
  const h = runtimeHarness(undefined, true);
  try {
    await h.runtime.start();
    h.callbacks()?.onCompleted("one", "First");
    h.callbacks()?.onCompleted("two", "Second");
    h.callbacks()?.onCompleted("three", "Third");
    release?.();
    await vi.waitFor(() => expect(h.snapshot().segments.find(s => s.id === "three")?.translation).toBe("T:Third"));
    expect(h.snapshot().segments.find(s => s.id === "two")?.translation).toBe("T:Second");
  } finally { release?.(); h.runtime.dispose(); vi.unstubAllGlobals(); }
});

it("does not clear a newer live partial when an earlier turn completes late", async () => {
  const h = runtimeHarness();
  try {
    await h.runtime.start(); h.callbacks()?.onPartial("one", "Earlier speech");
    h.callbacks()?.onPartial("two", "Current speech");
    h.callbacks()?.onCompleted("one", "Earlier final");
    expect(h.snapshot().partial).toBe("Current speech");
    expect(h.snapshot().partialItemId).toBe("two");
    expect(h.snapshot().segments[0]?.text).toBe("Earlier final");
  } finally { h.runtime.dispose(); }
});
