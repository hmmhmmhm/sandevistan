import { describe, expect, it } from "vitest";
import { createConversateLocalVad } from "./conversate-local-vad";

const pcm = (amplitude: number, milliseconds = 100) => {
  const bytes = new Uint8Array(16 * milliseconds * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < bytes.byteLength; index += 2) {
    view.setInt16(index, amplitude, true);
  }
  return bytes;
};

describe("Conversate local VAD", () => {
  it("keeps pre-roll, opens on speech, and commits after 800ms silence", () => {
    const push = createConversateLocalVad();
    for (let index = 0; index < 6; index += 1) push(pcm(0));
    push(pcm(4_000));
    const started = push(pcm(4_000));
    expect(started.audio).toHaveLength(5);
    expect(started.commit).toBe(false);
    let decision = push(pcm(0));
    for (let index = 1; index < 8; index += 1) decision = push(pcm(0));
    expect(decision.commit).toBe(true);
  });

  it("keeps quiet speech instead of dropping the whole turn", () => {
    const push = createConversateLocalVad();
    push(pcm(400));
    const started = push(pcm(400));
    expect(started.audio).toHaveLength(2);
  });

  it("does not open on a single short noise spike", () => {
    const push = createConversateLocalVad();
    const spike = push(pcm(2_000));
    expect(spike.audio).toEqual([]);
    expect(spike.started).toBe(false);
  });
});
