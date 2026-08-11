import { describe, expect, it, vi } from "vitest";
import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { type RealtimeSocket } from "./ai-realtime-transport";
import { createSonioxRealtimeSession } from "./soniox-realtime-session";

describe("Soniox realtime transcription", () => {
  it("sends native 16 kHz G2 PCM and finalizes a Soniox endpoint", async () => {
    const sent: Array<string | ArrayBufferLike | ArrayBufferView> = [];
    let listener: ((event: EvenHubEvent) => void) | undefined;
    const partial = vi.fn();
    const completed = vi.fn();
    const audioControl = vi.fn(async () => true);
    const socket: RealtimeSocket = {
      readyState: 1,
      onopen: null, onmessage: null, onerror: null, onclose: null,
      send(value) { sent.push(value); },
      close() {},
    };
    const session = createSonioxRealtimeSession({
      key: "soniox_test_1234567890abcdefghijklmnop",
      bridge: {
        audioControl,
        onEvenHubEvent(next) { listener = next; return () => { listener = undefined; }; },
      },
      onPartial: partial,
      onCompleted: completed,
      onError: vi.fn(),
      createSocket: () => {
        queueMicrotask(() => socket.onopen?.());
        return socket;
      },
    });
    await session.start();
    expect(JSON.parse(sent[0] as string)).toMatchObject({
      model: "stt-rt-v5", audio_format: "pcm_s16le", sample_rate: 16_000,
      enable_endpoint_detection: true,
    });
    const pcm = new Uint8Array([1, 2, 3, 4]);
    listener?.({ audioEvent: { source: AudioInputSource.Glasses, audioPcm: pcm } } as EvenHubEvent);
    expect(sent).toContain(pcm);
    socket.onmessage?.({ data: JSON.stringify({ tokens: [
      { text: "Hello", is_final: true }, { text: " world", is_final: false },
    ] }) } as MessageEvent<string>);
    expect(partial).toHaveBeenLastCalledWith("soniox-1", "Hello world");
    socket.onmessage?.({ data: JSON.stringify({ tokens: [
      { text: " world", is_final: true }, { text: "<end>", is_final: true },
    ] }) } as MessageEvent<string>);
    expect(completed).toHaveBeenCalledWith("soniox-1", "Hello world");
    await session.stop();
    expect(audioControl).toHaveBeenLastCalledWith(false);
  });
});
