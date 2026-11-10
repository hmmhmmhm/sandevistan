import { expect, it, vi } from "vitest";
import { createAiLiveCaptions } from "./ai-live-captions";

class Socket {
  readyState = 1;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send(text: string) { this.sent.push(JSON.parse(text)); }
  close() { this.readyState = 3; this.onclose?.(); }
  server(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>); }
}
function harness() {
  const socket = new Socket(), partial = vi.fn(), error = vi.fn();
  const captions = createAiLiveCaptions({ key: "test", fetchImpl: vi.fn(async () => Response.json({ value: "ek_test_123456789" })),
    createSocket: () => { queueMicrotask(() => socket.onopen?.()); return socket; }, onPartial: partial, onError: error });
  return { socket, captions, partial, error };
}
it("waits for live-model acknowledgement and uses the final model's commit boundaries", async () => {
  const h = harness(), abort = new AbortController();
  let ready = false;
  const started = h.captions.start(abort.signal).then(() => { ready = true; });
  await vi.waitFor(() => expect(h.socket.sent).toHaveLength(1));
  expect(ready).toBe(false);
  expect(h.socket.sent[0]).toMatchObject({ session: { audio: { input: { transcription: { model: "gpt-live-transcribe" }, turn_detection: null } } } });
  h.socket.server({ type: "session.updated" }); await started;
  h.captions.handlePrimary({ type: "input_audio_buffer.speech_started", item_id: "main1" });
  h.captions.append({ type: "input_audio_buffer.append", audio: "same-pcm" });
  h.socket.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: "Live preview" });
  expect(h.partial).toHaveBeenLastCalledWith("main1", "Live preview");
  h.captions.handlePrimary({ type: "input_audio_buffer.committed", item_id: "main1" });
  h.socket.server({ type: "input_audio_buffer.committed", item_id: "live1" });
  h.captions.handlePrimary({ type: "conversation.item.input_audio_transcription.completed", item_id: "main1", transcript: "Refined text" });
  h.socket.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: " stale" });
  expect(h.partial).toHaveBeenCalledTimes(1);
  h.captions.handlePrimary({ type: "input_audio_buffer.speech_started", item_id: "main2" });
  h.socket.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live1", delta: " late" });
  expect(h.partial).toHaveBeenCalledTimes(1);
  expect(h.socket.sent.filter(e => e.type === "input_audio_buffer.commit")).toHaveLength(1);
  expect(h.socket.sent.some(e => e.type === "response.create")).toBe(false);
  h.captions.stop();
  h.socket.server({ type: "conversation.item.input_audio_transcription.delta", item_id: "live2", delta: "after stop" });
  expect(h.partial).toHaveBeenCalledTimes(1); expect(h.error).not.toHaveBeenCalled();
});
it("aborts startup without leaving a live caption socket", async () => {
  const h = harness(), abort = new AbortController();
  const started = h.captions.start(abort.signal);
  const failed = expect(started).rejects.toThrow();
  await vi.waitFor(() => expect(h.socket.sent).toHaveLength(1));
  abort.abort(); await failed; expect(h.socket.readyState).toBe(3);
});
