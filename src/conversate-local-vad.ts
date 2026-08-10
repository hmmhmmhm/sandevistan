export type LocalVadDecision = {
  readonly audio: readonly Uint8Array[];
  readonly started: boolean;
  readonly commit: boolean;
};

const SAMPLE_RATE = 16_000;
const MIN_SPEECH_RMS = 0.008;
const NOISE_MULTIPLIER = 2.5;
const NOISE_FLOOR_ALPHA = 0.08;
const SPEECH_FRAMES_TO_START = 2;
const PRE_ROLL_MS = 500;
const SILENCE_MS = 800;
const MAX_UTTERANCE_MS = 15_000;

const durationMs = (bytes: Uint8Array) => bytes.byteLength / 2 / SAMPLE_RATE * 1_000;

function rms(bytes: Uint8Array) {
  const samples = Math.floor(bytes.byteLength / 2);
  if (!samples) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  let squares = 0;
  for (let index = 0; index < samples; index += 1) {
    const sample = view.getInt16(index * 2, true) / 32_768;
    squares += sample * sample;
  }
  return Math.sqrt(squares / samples);
}

export function createConversateLocalVad() {
  const preRoll: Array<{ bytes: Uint8Array; duration: number }> = [];
  let preRollMs = 0;
  let speaking = false;
  let silenceMs = 0;
  let utteranceMs = 0;
  let noiseFloor = MIN_SPEECH_RMS / NOISE_MULTIPLIER;
  let speechFrames = 0;

  return (bytes: Uint8Array): LocalVadDecision => {
    const duration = durationMs(bytes);
    const level = rms(bytes);
    const threshold = Math.max(MIN_SPEECH_RMS, noiseFloor * NOISE_MULTIPLIER);
    const speech = level >= threshold;
    if (!speaking) {
      preRoll.push({ bytes, duration });
      preRollMs += duration;
      while (preRollMs > PRE_ROLL_MS && preRoll.length > 1) {
        preRollMs -= preRoll.shift()?.duration ?? 0;
      }
      if (!speech) {
        noiseFloor += (level - noiseFloor) * NOISE_FLOOR_ALPHA;
        speechFrames = 0;
        return { audio: [], started: false, commit: false };
      }
      speechFrames += 1;
      if (speechFrames < SPEECH_FRAMES_TO_START) {
        return { audio: [], started: false, commit: false };
      }
      speaking = true;
      speechFrames = 0;
      silenceMs = 0;
      utteranceMs = preRollMs;
      const audio = preRoll.map((item) => item.bytes);
      preRoll.length = 0;
      preRollMs = 0;
      return { audio, started: true, commit: false };
    }

    utteranceMs += duration;
    silenceMs = speech ? 0 : silenceMs + duration;
    const commit = silenceMs >= SILENCE_MS || utteranceMs >= MAX_UTTERANCE_MS;
    if (commit) {
      speaking = false;
      silenceMs = 0;
      utteranceMs = 0;
      speechFrames = 0;
    }
    return { audio: [bytes], started: false, commit };
  };
}
