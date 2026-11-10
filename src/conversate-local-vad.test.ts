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
    const started = push(pcm(4_000));
    expect(started.audio).toHaveLength(5);
    expect(started.commit).toBe(false);
    let decision = push(pcm(0));
    for (let index = 1; index < 8; index += 1) decision = push(pcm(0));
    expect(decision.commit).toBe(true);
  });

  it("keeps quiet speech instead of dropping the whole turn", () => {
    const push = createConversateLocalVad();
    const started = push(pcm(200));
    expect(started.audio).toHaveLength(1);
  });
});

it("rejects steady background hiss while committing speech over that background", () => {
  const vad = createConversateLocalVad();
  let seed = 12345;
  const noise = (speech = false) => {
    const bytes = new Uint8Array(3_200);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 1_600; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const hiss = ((seed / 0x100000000) * 2 - 1) * 680;
      const voice = speech ? Math.sin(i * 2 * Math.PI * 180 / 16_000) * 4_000 : 0;
      view.setInt16(i * 2, Math.round(hiss + voice), true);
    }
    return bytes;
  };
  for (let i = 0; i < 12; i++) expect(vad(noise()).audio.length).toBe(0);
  expect(vad(noise(true)).audio.length).toBeGreaterThan(0);
  let committed = false;
  for (let i = 0; i < 10; i++) committed ||= vad(noise()).commit;
  expect(committed).toBe(true);
});

it("does not learn sustained speech fricatives as a new noise floor", () => {
  const vad = createConversateLocalVad();
  vad(pcm(4000));
  const fricative = new Uint8Array(3200); const values = new DataView(fricative.buffer);
  for (let i = 0; i < 1600; i++) values.setInt16(i * 2, i % 2 ? 1500 : -1500, true);
  for (let i = 0; i < 10; i++) expect(vad(fricative).commit).toBe(false);
  expect(vad(pcm(4000)).audio.length).toBeGreaterThan(0);
});
