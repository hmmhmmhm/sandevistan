import { handleConversateRequest, CONVERSATE_CUE_CONTEXT_TURNS, CONVERSATE_TRANSLATION_CONTEXT_TURNS, type PartialConversateAnalysis } from "../server/ai-web-search.js";
import { openAiKeyHeaders } from "./openai-key";
import { logDiagnostic } from "./diagnostic-log";
import type {
  ConversateSegment,
  ConversateSettings,
  ConversateSuggestion,
} from "./conversate-state";
import type { PhoneLocale } from "./phone-types";

export type ConversateAnalysis = {
  readonly language: string;
  readonly translation?: string;
  readonly inform?: string;
  readonly suggestions: readonly ConversateSuggestion[];
};

function isAnalysis(value: unknown): value is ConversateAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.language === "string"
    && (item.translation === undefined || typeof item.translation === "string")
    && (item.inform === undefined || typeof item.inform === "string")
    && Array.isArray(item.suggestions)
    && item.suggestions.every((suggestion) => (
      typeof suggestion === "object" && suggestion !== null
      && ["original", "pronunciation", "meaning", "style"].every(
        (key) => typeof (suggestion as Record<string, unknown>)[key] === "string",
      )
    ));
}

export async function requestConversateAnalysis(options: {
  readonly key: string;
  readonly model?: string;
  readonly locale: PhoneLocale;
  readonly settings: ConversateSettings;
  readonly segments: readonly ConversateSegment[];
  readonly signal: AbortSignal;
  readonly fetchImpl?: typeof fetch;
  readonly onPartial?: (value: PartialConversateAnalysis) => void;
}): Promise<ConversateAnalysis> {
  const response = await handleConversateRequest(new Request("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...openAiKeyHeaders(options.key),
    },
    body: JSON.stringify({
      locale: options.locale,
      model: options.model,
      settings: options.settings,
      transcript: options.segments.slice(-(options.settings.inform || options.settings.copilot
        ? CONVERSATE_CUE_CONTEXT_TURNS : CONVERSATE_TRANSLATION_CONTEXT_TURNS)).map(({ text }) => text),
    }),
    signal: options.signal,
  }), {}, { fetchImpl: options.fetchImpl ?? fetch, onPartial: options.onPartial });
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Conversate analysis unavailable");
  }
  if (!response.ok || !isAnalysis(value)) {
    const item = typeof value === "object" && value !== null
      ? value as Record<string, unknown> : {};
    const error = typeof item.error === "object" && item.error !== null
      ? item.error as Record<string, unknown> : {};
    logDiagnostic(
      "ERROR",
      `Conversate analysis rejected · status ${response.status}`
        + ` · code ${String(error.code ?? "unknown").slice(0, 80)}`
        + ` · upstream ${String(response.headers.get("x-sandevistan-upstream-code") ?? "unknown").slice(0, 80)}`,
    );
    throw new Error("Conversate analysis unavailable");
  }
  return value;
}
