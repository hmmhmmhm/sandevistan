import { readCache, writeCache, type EvenStorage } from "./live-cache";
import { BUILT_IN_RSS_FEEDS, RETIRED_RSS_FEEDS } from "../server/news-feeds.js";
import { isSupportedLocale } from "./i18n/locale-registry";
import type { PhoneLocale } from "./phone-types";

export type BuiltInRssFeed = string;

export type RssSource = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly isDefault: boolean;
  readonly locale?: PhoneLocale;
  readonly feed?: BuiltInRssFeed;
};

const BUILT_IN_RSS_SOURCES: readonly RssSource[] =
  BUILT_IN_RSS_FEEDS.flatMap((source) => (
    isSupportedLocale(source.locale)
      ? [{
          ...source,
          enabled: true,
          isDefault: true,
          locale: source.locale,
          feed: source.id,
        }]
      : []
  ));

export const DEFAULT_RSS_SOURCE: RssSource = {
  ...BUILT_IN_RSS_SOURCES[0],
};

const CUSTOM_SOURCE_LIMIT = 6;
const STORED_SOURCE_LIMIT =
  BUILT_IN_RSS_SOURCES.length + CUSTOM_SOURCE_LIMIT;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const BUILT_IN_IDS = new Set(BUILT_IN_RSS_SOURCES.map(({ id }) => id));
const BUILT_IN_FEEDS = new Set(
  [...BUILT_IN_RSS_SOURCES.map(({ feed }) => feed), ...RETIRED_RSS_FEEDS.map(({ id }) => id)],
);

type UrlValidation =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly code: "invalid" | "unsafe" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is RssSource {
  return isRecord(value)
    && typeof value.id === "string"
    && value.id.length > 0
    && typeof value.name === "string"
    && value.name.trim() === value.name
    && value.name.length > 0
    && typeof value.url === "string"
    && validateRssSourceUrl(value.url).ok
    && typeof value.enabled === "boolean"
    && typeof value.isDefault === "boolean"
    && (
      value.locale === undefined
      || isSupportedLocale(value.locale)
    )
    && (
      value.feed === undefined
      || BUILT_IN_FEEDS.has(value.feed as BuiltInRssFeed)
    );
}

function isStoredSourceList(value: unknown): value is readonly RssSource[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= STORED_SOURCE_LIMIT
    && value.every(isSource)
    && value.filter((source) => !source.isDefault).length
      <= CUSTOM_SOURCE_LIMIT
    && new Set(value.map((source) => source.id)).size === value.length;
}

function cloneSources(value: readonly RssSource[]): readonly RssSource[] {
  return value.map((source) => ({ ...source }));
}

function customizedBuiltIn(
  source: RssSource,
  stored: readonly RssSource[],
): RssSource {
  const retired = RETIRED_RSS_FEEDS.find(item => item.replacement === source.id);
  const saved = stored.find((candidate) => (
    candidate.id === source.id && candidate.isDefault
  )) ?? (retired ? stored.find(candidate => candidate.id === retired.id && candidate.isDefault) : undefined);
  return {
    ...source,
    ...(saved ? { name: retired && saved.id === retired.id && saved.name === retired.name ? source.name : saved.name, enabled: saved.enabled } : {}),
  };
}

function customSources(
  sources: readonly RssSource[],
): readonly RssSource[] {
  return sources
    .filter((source) => !source.isDefault && !BUILT_IN_IDS.has(source.id))
    .slice(0, CUSTOM_SOURCE_LIMIT)
    .map((source) => ({
      ...source,
      isDefault: false,
      locale: undefined,
      feed: undefined,
    }));
}

export function defaultRssSources(
  locale: PhoneLocale,
): readonly RssSource[] {
  return cloneSources(
    BUILT_IN_RSS_SOURCES.filter((source) => source.locale === locale),
  );
}

export function validateRssSourceUrl(value: string): UrlValidation {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.hash
      || (url.port && url.port !== "443")
      || !hostname.includes(".")
      || hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".local")
      || hostname.endsWith(".internal")
      || hostname.endsWith(".home")
      || hostname.endsWith(".lan")
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
      || hostname.includes(":")
    ) {
      return { ok: false, code: "unsafe" };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, code: "invalid" };
  }
}

function normalizeName(value: string): string {
  return [...value.trim().replace(/\s+/g, " ")]
    .slice(0, 40)
    .join("");
}

function sourceId(name: string, url: string): string {
  let hash = 0x811c9dc5;
  for (const character of `${name}\0${url}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `feed-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function addRssSource(
  sources: readonly RssSource[],
  name: string,
  urlValue: string,
): readonly RssSource[] {
  if (sources.filter((source) => !source.isDefault).length
    >= CUSTOM_SOURCE_LIMIT) {
    throw new Error("rss_source_limit");
  }
  const normalizedName = normalizeName(name);
  if (!normalizedName || CONTROL_CHARACTERS.test(normalizedName)) {
    throw new Error("rss_source_name");
  }
  const validation = validateRssSourceUrl(urlValue);
  if (!validation.ok) throw new Error("rss_source_url");
  if (
    sources.some((source) => source.url === validation.value)
    || BUILT_IN_RSS_SOURCES.some(
      (source) => source.url === validation.value,
    )
  ) {
    throw new Error("rss_source_duplicate");
  }
  return [
    ...cloneSources(sources),
    {
      id: sourceId(normalizedName, validation.value),
      name: normalizedName,
      url: validation.value,
      enabled: true,
      isDefault: false,
    },
  ];
}

export function deleteRssSource(
  sources: readonly RssSource[],
  id: string,
): readonly RssSource[] {
  if (sources.some((source) => source.id === id && source.isDefault)) {
    return sources;
  }
  return sources.filter((source) => source.id !== id);
}

export function updateRssSource(
  sources: readonly RssSource[],
  id: string,
  change: Partial<Pick<RssSource, "name" | "enabled">>,
): readonly RssSource[] {
  return sources.map((source) => {
    if (source.id !== id) return source;
    const name = change.name === undefined
      ? source.name
      : normalizeName(change.name);
    if (!name || CONTROL_CHARACTERS.test(name)) {
      throw new Error("rss_source_name");
    }
    return {
      ...source,
      name,
      enabled: change.enabled ?? source.enabled,
    };
  });
}

export async function resolveRssSources(
  storage: EvenStorage,
  locale: PhoneLocale = "ko",
): Promise<readonly RssSource[]> {
  const stored = await readCache(
    storage,
    "rss-sources",
    isStoredSourceList,
  ) ?? [];
  const builtIns = defaultRssSources(locale).map((source) => (
    customizedBuiltIn(source, stored)
  ));
  return [...builtIns, ...customSources(stored)];
}

export async function writeRssSources(
  storage: EvenStorage,
  sources: readonly RssSource[],
  locale: PhoneLocale = "ko",
): Promise<boolean> {
  const expectedIds = new Set(
    defaultRssSources(locale).map(({ id }) => id),
  );
  const activeBuiltIns = sources.filter((source) => source.isDefault);
  if (
    sources.length > CUSTOM_SOURCE_LIMIT + expectedIds.size
    || activeBuiltIns.length !== expectedIds.size
    || activeBuiltIns.some((source) => !expectedIds.has(source.id))
    || sources.some((source) => !isSource(source))
    || new Set(sources.map((source) => source.id)).size !== sources.length
  ) {
    return false;
  }

  const stored = await readCache(
    storage,
    "rss-sources",
    isStoredSourceList,
  ) ?? [];
  const allBuiltIns = BUILT_IN_RSS_SOURCES.map((source) => {
    const active = sources.find((candidate) => candidate.id === source.id);
    return customizedBuiltIn(source, active ? sources : stored);
  });
  const value = [...allBuiltIns, ...customSources(sources)];
  return writeCache(storage, "rss-sources", value);
}
