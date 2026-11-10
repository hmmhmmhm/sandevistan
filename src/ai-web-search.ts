import { handleAiWebSearchRequest } from "../server/ai-web-search.js";
import {
  type AiWebSearchResult,
  type AiCitationSource,
} from "./ai-tools";
import { openAiKeyHeaders } from "./openai-key";
import type { PhoneLocale } from "./phone-types";

const MAX_ANSWER = 8_000;
const MAX_SOURCES = 6;

function source(value: unknown): AiCitationSource | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.title !== "string" || typeof item.url !== "string") {
    return undefined;
  }
  try {
    const url = new URL(item.url);
    if (url.protocol !== "https:") return undefined;
    return { title: item.title.slice(0, 160), url: url.toString() };
  } catch {
    return undefined;
  }
}

function parseResult(value: unknown): AiWebSearchResult | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const item = value as Record<string, unknown>;
  const usage = typeof item.usage === "object" && item.usage !== null
    ? item.usage as Record<string, unknown>
    : undefined;
  const sources = Array.isArray(item.sources)
    ? item.sources.map(source).filter((entry) => entry !== undefined)
    : [];
  if (
    typeof item.answer !== "string"
    || !item.answer.trim()
    || item.answer.length > MAX_ANSWER
    || !usage
  ) return undefined;
  const model = typeof usage.model === "string"
    && usage.model.length > 0
    && usage.model.length <= 120
    && /^[A-Za-z0-9_.:-]+$/.test(usage.model)
    ? usage.model
    : undefined;
  const count = (key: string) => typeof usage[key] === "number"
    && Number.isFinite(usage[key])
    && (usage[key] as number) >= 0
    && (usage[key] as number) <= Number.MAX_SAFE_INTEGER
    ? Math.floor(usage[key] as number)
    : undefined;
  const inputTokens = count("inputTokens");
  const cachedInputTokens = count("cachedInputTokens");
  const outputTokens = count("outputTokens");
  const webSearchCalls = count("webSearchCalls");
  if (
    !model
    || inputTokens === undefined
    || cachedInputTokens === undefined
    || cachedInputTokens > inputTokens
    || outputTokens === undefined
    || webSearchCalls === undefined
  ) return undefined;
  return {
    answer: item.answer,
    sources: sources.slice(0, MAX_SOURCES),
    usage: {
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      webSearchCalls,
    },
  };
}

export async function requestAiWebSearch(options: {
  readonly key: string;
  readonly query: string;
  readonly model?: string;
  readonly locale: PhoneLocale;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<AiWebSearchResult> {
  const response = await handleAiWebSearchRequest(new Request("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      ...openAiKeyHeaders(options.key),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: options.query, locale: options.locale, model: options.model }),
    signal: options.signal,
  }), {}, { fetchImpl: options.fetchImpl ?? fetch });
  const data: unknown = await response.json();
  const parsed = parseResult(data);
  if (!response.ok || !parsed) throw new Error("Web search failed");
  return parsed;
}
