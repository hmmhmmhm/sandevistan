import { expect, it, vi } from "vitest";
import { createAiHoldCapture } from "./ai-hold-capture";
function harness() {
  const options = { ready: () => true, open: vi.fn(async () => true), close: vi.fn(async () => true), clear: vi.fn(), commit: vi.fn(),
    onBegin: vi.fn(), onCommitted: vi.fn(), onStatus: vi.fn(), onError: vi.fn() };
  return { options, gate: createAiHoldCapture(options) };
}
it("accepts only held audio and commits once on release rather than during pauses", async () => {
  const { options: o, gate: g } = harness();
  try {
    expect(g.acceptsAudio()).toBe(false); await g.begin(); expect(g.acceptsAudio()).toBe(true);
    g.countAudio(16000); await g.begin(); expect(o.open).toHaveBeenCalledTimes(1);
    expect(o.commit).not.toHaveBeenCalled(); g.end(); g.end(); expect(g.acceptsAudio()).toBe(false);
    expect(o.commit).toHaveBeenCalledTimes(1); expect(o.close).toHaveBeenCalledTimes(1);
    g.handle({ type: "input_audio_buffer.committed", item_id: "server1" });
    expect(o.onCommitted).toHaveBeenCalledWith("hold-1", "server1");
    g.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "server1" });
    await vi.waitFor(() => expect(o.onStatus).toHaveBeenLastCalledWith("waiting"));
    expect(o.onStatus).toHaveBeenLastCalledWith("waiting");
  } finally { g.dispose(); }
});
it("discards an empty or too-short hold instead of committing an invalid audio buffer", async () => {
  const { options: o, gate: g } = harness();
  try { await g.begin(); g.countAudio(100); g.end(); expect(o.commit).not.toHaveBeenCalled(); await vi.waitFor(() => expect(o.onStatus).toHaveBeenLastCalledWith("waiting")); }
  finally { g.dispose(); }
});
it("handles release before microphone acknowledgement and blocks overlapping activation", async () => {
  const { options: o, gate: g } = harness();
  let finish: ((opened: boolean) => void) | undefined;
  const opening = new Promise<boolean>(resolve => { finish = resolve; });
  o.open.mockReturnValue(opening); o.close.mockImplementation(async () => { await opening; return true; });
  const start = g.begin(); g.end(); await g.begin();
  expect(o.open).toHaveBeenCalledTimes(1); expect(g.acceptsAudio()).toBe(false);
  finish?.(true); await start; await vi.waitFor(() => expect(o.onStatus).toHaveBeenLastCalledWith("waiting"));
  expect(o.commit).not.toHaveBeenCalled(); g.dispose();
});
it("does not open a microphone while connections are unconfigured", async () => {
  const { options: o, gate: g } = harness(); o.ready = () => false;
  await g.begin(); expect(o.open).not.toHaveBeenCalled(); g.dispose();
});
it("does not reopen capture until a previous microphone close acknowledgement finishes", async () => {
  const { options: o, gate: g } = harness(); let finish: ((ok: boolean) => void) | undefined;
  o.close.mockReturnValue(new Promise<boolean>(resolve => { finish = resolve; }));
  try {
    await g.begin(); g.countAudio(3200); g.end();
    g.handle({ type: "input_audio_buffer.committed", item_id: "one" });
    g.handle({ type: "conversation.item.input_audio_transcription.completed", item_id: "one" });
    await g.begin(); expect(o.open).toHaveBeenCalledTimes(1);
    finish?.(true); await vi.waitFor(() => expect(o.onStatus).toHaveBeenLastCalledWith("waiting"));
    await g.begin(); expect(o.open).toHaveBeenCalledTimes(2);
  } finally { g.dispose(); }
});
