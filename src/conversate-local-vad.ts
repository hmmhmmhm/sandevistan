export type LocalVadDecision = {
  readonly audio: readonly Uint8Array[];
  readonly commit: boolean;
};

const SAMPLE_RATE = 16_000;
const SPEECH_RMS = 0.006;
const PRE_ROLL_MS = 500;
const SILENCE_MS = 800;
const MAX_UTTERANCE_MS = 15_000;

const durationMs = (bytes: Uint8Array) => bytes.byteLength / 2 / SAMPLE_RATE * 1_000;

function audioEnergy(bytes: Uint8Array) {
  const samples = Math.floor(bytes.byteLength / 2);
  if (!samples) return { rms: 0, crossingRate: 0 };
  const view = new DataView(bytes.buffer, bytes.byteOffset, samples * 2);
  let squares = 0;
  let crossings = 0;
  let previous = 0;
  for (let index = 0; index < samples; index += 1) {
    const sample = view.getInt16(index * 2, true) / 32_768;
    squares += sample * sample;
    if (index > 0 && (sample >= 0) !== (previous >= 0)) crossings += 1;
    previous = sample;
  }
  return { rms: Math.sqrt(squares / samples), crossingRate: crossings / samples };
}

export function createConversateLocalVad() {
  const preRoll: Array<{ bytes: Uint8Array; duration: number }> = [];
  let preRollMs = 0;
  let speaking = false;
  let silenceMs = 0;
  let utteranceMs = 0;
  let noiseFloor = 0;

  return (bytes: Uint8Array): LocalVadDecision => {
    const duration = durationMs(bytes);
    const energy = audioEnergy(bytes);
    if (!speaking && energy.crossingRate > 0.35 && energy.rms < 0.06) {
      noiseFloor = noiseFloor ? noiseFloor * 0.8 + energy.rms * 0.2 : energy.rms;
    } else if (!speaking && energy.rms < SPEECH_RMS) {
      noiseFloor *= 0.9;
    }
    const threshold = Math.max(SPEECH_RMS, noiseFloor * (speaking ? 1.8 : 2.5));
    const speech = energy.rms >= threshold;
    if (!speaking) {
      preRoll.push({ bytes, duration });
      preRollMs += duration;
      while (preRollMs > PRE_ROLL_MS && preRoll.length > 1) {
        preRollMs -= preRoll.shift()?.duration ?? 0;
      }
      if (!speech) return { audio: [], commit: false };
      speaking = true;
      silenceMs = 0;
      utteranceMs = preRollMs;
      const audio = preRoll.map((item) => item.bytes);
      preRoll.length = 0;
      preRollMs = 0;
      return { audio, commit: false };
    }

    utteranceMs += duration;
    silenceMs = speech ? 0 : silenceMs + duration;
    const commit = silenceMs >= SILENCE_MS || utteranceMs >= MAX_UTTERANCE_MS;
    if (commit) {
      speaking = false;
      silenceMs = 0;
      utteranceMs = 0;
    }
    return { audio: [bytes], commit };
  };
}
