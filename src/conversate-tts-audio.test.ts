import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";
import { describe, expect, it } from "vitest";
import { createPcm16Le16To24Resampler } from "./ai-realtime-audio";
import { createConversateLocalVad } from "./conversate-local-vad";

function wavPcm16(bytes: Uint8Array) {
  for (let index = 12; index + 8 <= bytes.length;) {
    const id = String.fromCharCode(...bytes.slice(index, index + 4));
    const length = new DataView(bytes.buffer, bytes.byteOffset + index + 4, 4)
      .getUint32(0, true);
    const body = index + 8;
    if (id === "data") return bytes.slice(body, body + length);
    index = body + length + length % 2;
  }
  throw new Error("WAV data chunk missing");
}

function concatPcm(parts: readonly Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

const isDarwin = platform === "darwin";

describe("Conversate TTS audio smoke test", () => {
  it.skipIf(!isDarwin)(
    "keeps a real Korean TTS waveform intact across uneven G2-style PCM packets",
    () => {
      const directory = mkdtempSync(join(tmpdir(), "sandevistan-conversate-"));
      const source = join(directory, "sample.aiff");
      const wav = join(directory, "sample.wav");
      try {
        execFileSync("say", [
          "-v", "Yuna", "-o", source,
          "안녕하세요. OpenAI와 Soniox 전사를 비교합니다. 오늘 회의는 오후 세 시입니다.",
        ]);
        execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", source, wav]);
        const pcm = wavPcm16(new Uint8Array(readFileSync(wav)));
        expect(pcm.byteLength).toBeGreaterThan(16_000);

        const resampler = createPcm16Le16To24Resampler();
        const output: Uint8Array[] = [];
        for (let offset = 0, size = 317; offset < pcm.length; size = (size * 7) % 1_001 + 79) {
          const next = pcm.slice(offset, Math.min(offset + size, pcm.length));
          output.push(resampler.push(next));
          offset += next.length;
        }
        output.push(resampler.flush());
        const resampled = concatPcm(output);
        expect(resampled.byteLength / 2).toBeCloseTo(pcm.byteLength / 2 * 1.5, 0);

        const vad = createConversateLocalVad();
        let opened = false;
        let committed = false;
        for (let offset = 0; offset < pcm.length; offset += 1_600) {
          const decision = vad(pcm.slice(offset, offset + 1_600));
          opened ||= decision.started;
          committed ||= decision.commit;
        }
        const silence = new Uint8Array(1_600);
        for (let index = 0; index < 20; index += 1) committed ||= vad(silence).commit;
        expect(opened).toBe(true);
        expect(committed).toBe(true);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
