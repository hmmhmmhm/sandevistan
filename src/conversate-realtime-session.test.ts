import { describe, expect, it, vi } from "vitest";
import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createConversateRealtimeSession } from "./conversate-realtime-session";
import type { RealtimeSocket } from "./ai-realtime-transport";

const pcm = (amplitude: number, milliseconds = 100) => {
  const bytes = new Uint8Array(16 * milliseconds * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < bytes.byteLength; index += 2) view.setInt16(index, amplitude, true);
  return bytes;
};

describe("Conversate realtime transcription", () => {
  it("uses gpt-live-transcribe, publishes deltas, and closes the G2 microphone", async () => {
    const sent: string[][] = [];
    const sockets: RealtimeSocket[] = [];
    let listener: ((event: EvenHubEvent) => void) | undefined;
    const audioControl = vi.fn(async () => true);
    const partial = vi.fn();
    const completed = vi.fn();
    const refined = vi.fn();
    const error = vi.fn();
    const session = createConversateRealtimeSession({
      bridge: {
        audioControl,
        onEvenHubEvent(next) { listener = next; return () => { listener = undefined; }; },
      },
      key: "sk-test-1234567890abcdefghijklmnop",
      locale: "ko",
      prompt: "Live conversation about Sandevistan",
      languages: ["ko", "en"],
      keywords: ["Sandevistan", "G2"],
      onPartial: partial,
      onCompleted: completed,
      onRefined: refined,
      onError: error,
      fetchImpl: vi.fn(async () => Response.json({ value: "ek_test_ephemeral" })) as typeof fetch,
      createSocket: () => {
        const messages: string[] = [];
        const socket: RealtimeSocket = {
          readyState: 1,
          onopen: null, onmessage: null, onerror: null, onclose: null,
          send(value) {
            messages.push(value);
            if (JSON.parse(value).type === "session.update") {
              queueMicrotask(() => socket.onmessage?.({
                data: JSON.stringify({ type: "session.updated" }),
              } as MessageEvent<string>));
            }
          },
          close() {},
        };
        sent.push(messages);
        sockets.push(socket);
        queueMicrotask(() => socket?.onopen?.());
        return socket;
      },
    });
    await session.start();
    const liveUpdate = sent[0]?.map((value) => JSON.parse(value))
      .find(({ type }) => type === "session.update");
    expect(liveUpdate.session.audio.input.transcription).toMatchObject({
      model: "gpt-live-transcribe", delay: "high",
      languages: ["ko", "en"], keywords: ["Sandevistan", "G2"],
    });
    expect(liveUpdate.session.audio.input.noise_reduction).toEqual({ type: "far_field" });
    expect(liveUpdate.session.audio.input.turn_detection).toBeNull();
    const refinementUpdate = sent[1]?.map((value) => JSON.parse(value))
      .find(({ type }) => type === "session.update");
    expect(refinementUpdate.session.audio.input.transcription).toMatchObject({
      model: "gpt-transcribe", prompt: "Live conversation about Sandevistan",
      languages: ["ko", "en"], keywords: ["Sandevistan", "G2"],
    });
    sockets[0]?.onmessage?.({ data: JSON.stringify({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "item-1",
      delta: "안녕",
    }) } as MessageEvent<string>);
    sockets[0]?.onmessage?.({ data: JSON.stringify({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item-1",
      transcript: "안녕하세요",
    }) } as MessageEvent<string>);
    sockets[1]?.onmessage?.({ data: JSON.stringify({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "refined-1",
      transcript: "안녕하십니까",
    }) } as MessageEvent<string>);
    expect(partial).toHaveBeenCalledWith("item-1", "안녕");
    expect(completed).toHaveBeenCalledWith("item-1", "안녕하세요");
    expect(refined).toHaveBeenCalledWith("item-1", "안녕하십니까");
    sockets[0]?.onmessage?.({ data: JSON.stringify({ type: "error" }) } as MessageEvent<string>);
    expect(error).toHaveBeenCalledWith("Transcription session error");
    listener?.({ audioEvent: {
      source: AudioInputSource.Glasses, audioPcm: pcm(4_000),
    } } as EvenHubEvent);
    listener?.({ audioEvent: {
      source: AudioInputSource.Glasses, audioPcm: pcm(4_000),
    } } as EvenHubEvent);
    for (let index = 0; index < 8; index += 1) listener?.({ audioEvent: {
      source: AudioInputSource.Glasses, audioPcm: pcm(0),
    } } as EvenHubEvent);
    expect(sent.every((messages) => messages.map((value) => JSON.parse(value).type)
      .includes("input_audio_buffer.append"))).toBe(true);
    expect(sent.every((messages) => messages.map((value) => JSON.parse(value).type)
      .includes("input_audio_buffer.commit"))).toBe(true);
    await session.stop();
    expect(audioControl).toHaveBeenNthCalledWith(1, true, AudioInputSource.Glasses);
    expect(audioControl).toHaveBeenLastCalledWith(false);
  });
});
