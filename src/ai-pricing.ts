export const AI_PRICING_VERSION = "openai-2026-11-08-standard" as const;
export const LEGACY_AI_PRICING_VERSION = "sandevistan-legacy-category-rates" as const;

export type AiUsageCharge = {
  readonly estimatedNanoUsd: number;
  readonly unpricedEvents: number;
  readonly pricingVersions: readonly string[];
};

export type RealtimePricingInput = {
  readonly model: string;
  readonly textInputTokens: number;
  readonly cachedTextInputTokens: number;
  readonly audioInputTokens: number;
  readonly cachedAudioInputTokens: number;
  readonly textOutputTokens: number;
};

export type TranscriptionPricingInput = {
  readonly model: string;
  readonly audioInputTokens: number;
  readonly textOutputTokens: number;
};

export type SearchPricingInput = {
  readonly model: string;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly webSearchCalls: number;
};

const NANO_USD_PER_SEARCH_ACTION = 10_000_000;

function count(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function charge(estimatedNanoUsd: number, unpricedEvents = 0): AiUsageCharge {
  return {
    estimatedNanoUsd: Math.max(0, Math.round(estimatedNanoUsd)),
    unpricedEvents: count(unpricedEvents),
    pricingVersions: [AI_PRICING_VERSION],
  };
}

export function emptyAiUsageCharge(): AiUsageCharge {
  return { estimatedNanoUsd: 0, unpricedEvents: 0, pricingVersions: [] };
}

export function mergeAiUsageCharge(
  left: AiUsageCharge,
  right: AiUsageCharge,
): AiUsageCharge {
  return {
    estimatedNanoUsd: count(left.estimatedNanoUsd) + count(right.estimatedNanoUsd),
    unpricedEvents: count(left.unpricedEvents) + count(right.unpricedEvents),
    pricingVersions: [...new Set([
      ...left.pricingVersions,
      ...right.pricingVersions,
    ])],
  };
}

export function priceRealtimeUsage(input: RealtimePricingInput): AiUsageCharge {
  const legacy = input.model === "gpt-realtime" || /^gpt-realtime-2025-\d{2}-\d{2}$/.test(input.model);
  const current = input.model === "gpt-realtime-2.1";
  if (!legacy && !current) {
    const hasUsage = [
      input.textInputTokens,
      input.cachedTextInputTokens,
      input.audioInputTokens,
      input.cachedAudioInputTokens,
      input.textOutputTokens,
    ].some((value) => count(value) > 0);
    return charge(0, hasUsage ? 1 : 0);
  }
  return charge(
    count(input.textInputTokens) * 4_000
    + count(input.cachedTextInputTokens) * 400
    + count(input.audioInputTokens) * 32_000
    + count(input.cachedAudioInputTokens) * 400
    + count(input.textOutputTokens) * (current ? 24_000 : 16_000),
  );
}

export function priceTranscriptionUsage(
  input: TranscriptionPricingInput,
): AiUsageCharge {
  if (
    input.model !== "gpt-4o-mini-transcribe"
    && !input.model.startsWith("gpt-4o-mini-transcribe-")
  ) {
    const hasUsage = count(input.audioInputTokens) > 0
      || count(input.textOutputTokens) > 0;
    return charge(0, hasUsage ? 1 : 0);
  }
  return charge(
    count(input.audioInputTokens) * 1_250
    + count(input.textOutputTokens) * 5_000,
  );
}

export function priceSearchUsage(input: SearchPricingInput): AiUsageCharge {
  const actionCost = count(input.webSearchCalls) * NANO_USD_PER_SEARCH_ACTION;
  const totalInput = count(input.inputTokens);
  const cachedInput = Math.min(totalInput, count(input.cachedInputTokens));
  const output = count(input.outputTokens);
  const legacy = input.model === "gpt-5.5" || /^gpt-5\.5-\d{4}-\d{2}-\d{2}$/.test(input.model);
  const current = input.model === "gpt-6.1-sol";
  const supported = legacy || current;
  if (!supported) {
    return charge(actionCost, totalInput > 0 || output > 0 ? 1 : 0);
  }
  return charge(
    (totalInput - cachedInput) * (current ? 2_000 : 5_000)
    + cachedInput * (current ? 100 : 500)
    + output * (current ? 10_000 : 30_000)
    + actionCost,
  );
}
