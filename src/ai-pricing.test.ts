import { describe, expect, it } from "vitest";
import {
  AI_PRICING_VERSION,
  mergeAiUsageCharge,
  priceRealtimeUsage,
  priceSearchUsage,
  priceTranscriptionUsage,
} from "./ai-pricing";

describe("AI pricing snapshots", () => {
  it("prices current Realtime and transcription models in integer nano-USD", () => {
    expect(priceRealtimeUsage({
      model: "gpt-realtime",
      textInputTokens: 1_000_000,
      cachedTextInputTokens: 1_000_000,
      audioInputTokens: 1_000_000,
      cachedAudioInputTokens: 1_000_000,
      textOutputTokens: 1_000_000,
    })).toEqual({
      estimatedNanoUsd: 52_800_000_000,
      unpricedEvents: 0,
      pricingVersions: [AI_PRICING_VERSION],
    });
    expect(priceTranscriptionUsage({
      model: "gpt-4o-mini-transcribe",
      audioInputTokens: 1_000_000,
      textOutputTokens: 1_000_000,
    }).estimatedNanoUsd).toBe(6_250_000_000);
  });

  it("prices gpt-5.5 tokens and only reported web-search actions", () => {
    expect(priceSearchUsage({
      model: "gpt-5.5-2026-07-01",
      inputTokens: 1_000_000,
      cachedInputTokens: 200_000,
      outputTokens: 1_000_000,
      webSearchCalls: 2,
    })).toEqual({
      estimatedNanoUsd: 34_120_000_000,
      unpricedEvents: 0,
      pricingVersions: [AI_PRICING_VERSION],
    });
  });

  it("keeps known action fees but marks unknown-model token usage unpriced", () => {
    expect(priceSearchUsage({
      model: "future-model",
      inputTokens: 10,
      cachedInputTokens: 0,
      outputTokens: 5,
      webSearchCalls: 1,
    })).toEqual({
      estimatedNanoUsd: 10_000_000,
      unpricedEvents: 1,
      pricingVersions: [AI_PRICING_VERSION],
    });
  });

  it("merges charges without duplicating pricing versions", () => {
    expect(mergeAiUsageCharge(
      { estimatedNanoUsd: 10, unpricedEvents: 1, pricingVersions: ["v1"] },
      { estimatedNanoUsd: 20, unpricedEvents: 2, pricingVersions: ["v1", "v2"] },
    )).toEqual({
      estimatedNanoUsd: 30,
      unpricedEvents: 3,
      pricingVersions: ["v1", "v2"],
    });
  });
});

it("prices current aliases and marks an unknown future Realtime model unpriced", () => {
  const usage = { textInputTokens: 0, cachedTextInputTokens: 0, audioInputTokens: 0, cachedAudioInputTokens: 0, textOutputTokens: 1_000_000 };
  expect(priceRealtimeUsage({ ...usage, model: "gpt-realtime-2.1" }).estimatedNanoUsd).toBe(24_000_000_000);
  expect(priceRealtimeUsage({ ...usage, model: "gpt-realtime-99" }).unpricedEvents).toBe(1);
  expect(priceSearchUsage({ model: "gpt-6.1-sol", inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000, webSearchCalls: 0 }).estimatedNanoUsd).toBe(12_000_000_000);
});
