import { AI_WEATHER_TOOL, requestAiWeather } from "./ai-weather";
import type { DataState, LocationValue } from "./live-state";
import type { PhoneLocale } from "./phone-types";

const MAX_LOCATION_AGE_MS = 120_000;
const MAX_SEARCH_QUERY = 500;

export type AiCitationSource = {
  readonly title: string;
  readonly url: string;
};

export type AiWebSearchUsage = {
  readonly model: string;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  readonly webSearchCalls: number;
};

export type AiWebSearchResult = {
  readonly answer: string;
  readonly sources: readonly AiCitationSource[];
  readonly usage: AiWebSearchUsage;
};

export type BuiltinAiToolResult =
  | {
      readonly ok: true;
      readonly data: Record<string, unknown>;
      readonly sources?: readonly AiCitationSource[];
      readonly usage?: AiWebSearchUsage;
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export const BUILTIN_AI_TOOLS = [
  AI_WEATHER_TOOL,
  {
    type: "function" as const,
    name: "get_current_time",
    description: "Get the exact current local time, date, timezone, and UTC offset.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    name: "get_current_location",
    description: "Get the latest exact live GPS location from the user's glasses session. Call only when location is needed.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    name: "search_web",
    description: "Search the live web for current or factual information and return grounded sources.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: MAX_SEARCH_QUERY },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
] as const;

function failed(code: string, message: string): BuiltinAiToolResult {
  return { ok: false, error: { code, message } };
}

function utcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}`
    + `:${String(absolute % 60).padStart(2, "0")}`;
}

function parseObject(value: string): Record<string, unknown> | undefined {
  if (value.length > 2_048) return undefined;
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

export async function executeBuiltinAiTool(
  name: string,
  rawArguments: string,
  context: {
    readonly locale: PhoneLocale;
    readonly fetchImpl?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly now: () => Date;
    readonly getLocation: () => DataState<LocationValue>;
    readonly searchWeb: (
      query: string,
      locale: PhoneLocale,
    ) => Promise<AiWebSearchResult>;
  },
): Promise<BuiltinAiToolResult> {
  const args = parseObject(rawArguments);
  if (!args) return failed("INVALID_ARGUMENTS", "Tool arguments are invalid");
  if(name === "get_weather") {
    try { const result=await requestAiWeather(args,{locale:context.locale,fetchImpl:context.fetchImpl,signal:context.signal});return {ok:true,...result}; }
    catch(error) { return failed("WEATHER_UNAVAILABLE",error instanceof Error?error.message:"Weather is unavailable"); }
  }
  if (name === "get_current_time") {
    const date = context.now();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return {
      ok: true,
      data: {
        iso: date.toISOString(),
        timezone,
        utcOffset: utcOffset(date),
        locale: context.locale,
        display: new Intl.DateTimeFormat(context.locale, {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: timezone,
        }).format(date),
      },
    };
  }
  if (name === "get_current_location") {
    const location = context.getLocation();
    const age = context.now().getTime() - (location.fetchedAt ?? 0);
    if (
      location.status !== "fresh"
      || location.value?.source !== "live"
      || age < 0
      || age > MAX_LOCATION_AGE_MS
    ) {
      return failed("LOCATION_UNAVAILABLE", "Live GPS is unavailable");
    }
    return {
      ok: true,
      data: {
        latitude: location.value.coordinate.latitude,
        longitude: location.value.coordinate.longitude,
        accuracyMeters: location.value.accuracy,
        speedMetersPerSecond: location.value.speed,
        headingDegrees: location.value.heading,
        source: "live",
        timestamp: new Date(location.fetchedAt ?? context.now().getTime())
          .toISOString(),
      },
    };
  }
  if (name === "search_web") {
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query || query.length > MAX_SEARCH_QUERY) {
      return failed("INVALID_ARGUMENTS", "A bounded search query is required");
    }
    try {
      const result = await context.searchWeb(query, context.locale);
      return {
        ok: true,
        data: { answer: result.answer, sources: result.sources },
        sources: result.sources,
        usage: result.usage,
      };
    } catch {
      return failed("WEB_SEARCH_FAILED", "Web search is unavailable");
    }
  }
  return failed("UNKNOWN_TOOL", "The requested tool is unavailable");
}
