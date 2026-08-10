function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : "=";
    output += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return output;
}

export function createAudioAppendEvent(bytes: Uint8Array) {
  return {
    type: "input_audio_buffer.append" as const,
    audio: bytesToBase64(bytes),
  };
}

function pcm16le(samples: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * 2, samples[index] ?? 0, true);
  }
  return bytes;
}

/**
 * Stateful 16 kHz -> 24 kHz PCM16 resampler.
 *
 * A Realtime audio stream arrives in arbitrary-sized packets. Keeping the
 * fractional source position and the last source sample prevents a packet
 * boundary from changing the waveform or its duration.
 */
export function createPcm16Le16To24Resampler() {
  let samples: number[] = [];
  let sampleOffset = 0;
  let nextPositionThirds = 0;
  let trailingByte: number | undefined;

  const append = (bytes: Uint8Array) => {
    let input = bytes;
    if (trailingByte !== undefined) {
      input = new Uint8Array(bytes.length + 1);
      input[0] = trailingByte;
      input.set(bytes, 1);
      trailingByte = undefined;
    }
    if (input.length % 2) {
      trailingByte = input.at(-1);
      input = input.slice(0, -1);
    }
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    for (let index = 0; index < input.byteLength; index += 2) {
      samples.push(view.getInt16(index, true));
    }
  };

  const drain = (final = false) => {
    if (!samples.length) return new Uint8Array();
    const output: number[] = [];
    const lastIndex = sampleOffset + samples.length - 1;
    while (true) {
      const lowerIndex = Math.floor(nextPositionThirds / 3);
      const remainder = nextPositionThirds % 3;
      if (lowerIndex > lastIndex || (!final && remainder > 0 && lowerIndex + 1 > lastIndex)) {
        break;
      }
      const lower = samples[lowerIndex - sampleOffset] ?? 0;
      const upper = samples[Math.min(lowerIndex + 1, lastIndex) - sampleOffset] ?? lower;
      output.push(Math.round(lower + (upper - lower) * remainder / 3));
      nextPositionThirds += 2;
    }
    const nextLowerIndex = Math.floor(nextPositionThirds / 3);
    const discard = Math.max(0, Math.min(samples.length - 1, nextLowerIndex - sampleOffset));
    if (discard) {
      samples = samples.slice(discard);
      sampleOffset += discard;
    }
    return pcm16le(output);
  };

  return {
    push(bytes: Uint8Array) {
      append(bytes);
      return drain();
    },
    flush() {
      const output = drain(true);
      samples = [];
      sampleOffset = 0;
      nextPositionThirds = 0;
      trailingByte = undefined;
      return output;
    },
    reset() {
      samples = [];
      sampleOffset = 0;
      nextPositionThirds = 0;
      trailingByte = undefined;
    },
  };
}

/** One-shot helper retained for non-streaming callers and unit tests. */
export function resamplePcm16Le16To24(bytes: Uint8Array): Uint8Array {
  const resampler = createPcm16Le16To24Resampler();
  const streamed = resampler.push(bytes);
  const final = resampler.flush();
  const output = new Uint8Array(streamed.length + final.length);
  output.set(streamed);
  output.set(final, streamed.length);
  return output;
}
