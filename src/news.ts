import { readCache, writeCache, type EvenStorage } from "./live-cache";
import type { DataState, NewsItem } from "./live-state";
import { logDiagnostic } from "./diagnostic-log";
import {
  defaultRssSources,
  resolveRssSources,
  type RssSource,
} from "./rss-sources";
import type { PhoneLocale } from "./phone-types";

export const NEWS_MAX_AGE_MS = 60 * 60 * 1000;
export const NEWS_LIMIT = 100;
const NEWS_TIMEOUT_MS = 8_000;
const NEWS_SUMMARY_MAX_CODE_POINTS = 360;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type NewsCache = {
  readonly value: readonly NewsItem[];
  readonly fetchedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNewsItem(value: unknown): value is NewsItem {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string"
    || value.id.length === 0
    || typeof value.title !== "string"
    || value.title.length === 0
  ) {
    return false;
  }
  if (
    value.source !== undefined
    && (
      typeof value.source !== "string"
      || value.source.length === 0
      || value.source !== value.source.trim()
      || [...value.source].length > 40
      || CONTROL_CHARACTERS.test(value.source)
    )
  ) {
    return false;
  }
  if (
    value.url !== undefined
    && (typeof value.url !== "string" || !isHttpUrl(value.url))
  ) {
    return false;
  }
  if (
    value.summary !== undefined
    && (
      typeof value.summary !== "string"
      || value.summary.length === 0
      || value.summary !== value.summary.trim()
      || [...value.summary].length > NEWS_SUMMARY_MAX_CODE_POINTS
      || CONTROL_CHARACTERS.test(value.summary)
    )
  ) {
    return false;
  }
  return value.publishedAt === undefined
    || (typeof value.publishedAt === "number"
      && Number.isFinite(value.publishedAt));
}

function isNewsCache(value: unknown): value is NewsCache {
  return isRecord(value)
    && typeof value.fetchedAt === "number"
    && Number.isFinite(value.fetchedAt)
    && Array.isArray(value.value)
    && value.value.length > 0
    && value.value.length <= NEWS_LIMIT
    && value.value.every(isNewsItem);
}

function sanitizeText(value: string): string {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeSummary(value: string): string | undefined {
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script,style").forEach((node) => node.remove());
  const clean = (document.body.textContent ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return [...clean].slice(0, NEWS_SUMMARY_MAX_CODE_POINTS).join("");
}

function childText(item: Element, selector: string): string {
  return [...item.children].find(
    (child) => child.localName === selector,
  )?.textContent ?? "";
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeUrl(value: string): string | undefined {
  const normalized = sanitizeText(value);
  return normalized && isHttpUrl(normalized) ? normalized : undefined;
}

function cloneItems(items: readonly NewsItem[]): readonly NewsItem[] {
  return items.map((item) => ({ ...item }));
}

export function mergeNewsItems(
  network: readonly NewsItem[],
  cached: readonly NewsItem[],
): readonly NewsItem[] {
  const records: Array<NewsItem & { readonly mergeIndex: number }> = [];
  const seen = new Set<string>();
  for (const [mergeIndex, item] of [...network, ...cached].entries()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    records.push({ ...item, mergeIndex });
  }
  records.sort((left, right) => {
    const leftHasDate = left.publishedAt !== undefined;
    const rightHasDate = right.publishedAt !== undefined;
    if (leftHasDate && rightHasDate) {
      const dateOrder = right.publishedAt! - left.publishedAt!;
      return dateOrder || left.mergeIndex - right.mergeIndex;
    }
    if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;
    return left.mergeIndex - right.mergeIndex;
  });
  return records
    .slice(0, NEWS_LIMIT)
    .map(({ mergeIndex: _, ...item }) => item);
}

type NewsSourceLabel = Pick<RssSource, "id" | "name">;

function feedLink(item: Element, atom: boolean): string {
  if (!atom) return childText(item, "link");
  const links = [...item.children].filter(
    (child) => child.localName === "link",
  );
  return (
    links.find((link) => (
      !link.getAttribute("rel") || link.getAttribute("rel") === "alternate"
    ))?.getAttribute("href")
    ?? links[0]?.getAttribute("href")
    ?? ""
  );
}

export function parseNewsFeed(
  xml: string,
  source?: NewsSourceLabel,
): readonly NewsItem[] {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const root = document.documentElement.localName;
  const atom = root === "feed";
  if (
    document.querySelector("parsererror")
    || (root !== "rss" && root !== "feed" && root.toLowerCase() !== "rdf")
  ) {
    return [];
  }

  const records: Array<NewsItem & { readonly sourceIndex: number }> = [];
  const seen = new Set<string>();
  for (const [sourceIndex, item] of [
    ...document.getElementsByTagName(atom ? "entry" : "item"),
  ].entries()) {
    const title = sanitizeText(childText(item, "title"));
    if (!title) continue;
    const guid = sanitizeText(childText(item, atom ? "id" : "guid"));
    const url = normalizeUrl(feedLink(item, atom));
    const summary = sanitizeSummary(
      childText(item, atom ? "summary" : "description")
      || (atom ? childText(item, "content") : ""),
    );
    const id = guid
      ? `guid:${guid}`
      : url
        ? `link:${url}`
        : `title:${fnv1a(title)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const parsedDate = Date.parse(sanitizeText(
      childText(item, atom ? "updated" : "pubDate")
      || (atom ? childText(item, "published") : ""),
    ));
    const sourceName = source
      ? [...sanitizeText(source.name)].slice(0, 40).join("")
      : "";
    records.push({
      id,
      title,
      ...(sourceName ? { source: sourceName } : {}),
      ...(url ? { url } : {}),
      ...(Number.isFinite(parsedDate) ? { publishedAt: parsedDate } : {}),
      ...(summary ? { summary } : {}),
      sourceIndex,
    });
  }

  records.sort((left, right) => {
    const leftHasDate = left.publishedAt !== undefined;
    const rightHasDate = right.publishedAt !== undefined;
    if (leftHasDate && rightHasDate) {
      const dateOrder = right.publishedAt! - left.publishedAt!;
      return dateOrder || left.sourceIndex - right.sourceIndex;
    }
    if (leftHasDate !== rightHasDate) return leftHasDate ? -1 : 1;
    return left.sourceIndex - right.sourceIndex;
  });

  return records.slice(0, NEWS_LIMIT).map(({ sourceIndex: _, ...item }) => item);
}

export function parseNewsRss(xml: string): readonly NewsItem[] {
  return parseNewsFeed(xml);
}

function toState(
  cache: NewsCache,
  status: "fresh" | "stale",
): DataState<readonly NewsItem[]> {
  return {
    status,
    value: cloneItems(cache.value),
    fetchedAt: cache.fetchedAt,
  };
}

export async function resolveNews(
  storage: EvenStorage,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
  onCached?: (cached: DataState<readonly NewsItem[]>) => void,
  force = false,
  locale: PhoneLocale = "ko",
): Promise<DataState<readonly NewsItem[]>> {
  const cached = await readCache(storage, "news", isNewsCache);
  const usableCache = cached && cached.fetchedAt <= now ? cached : undefined;
  if (usableCache) {
    const status = now - usableCache.fetchedAt <= NEWS_MAX_AGE_MS
      ? "fresh"
      : "stale";
    const cachedState = toState(usableCache, status);
    onCached?.(cachedState);
    if (status === "fresh" && !force) return cachedState;
  }

  let sources: readonly RssSource[] = (await resolveRssSources(storage, locale))
    .filter((source) => source.enabled);
  if (sources.length === 0) {
    sources = defaultRssSources(locale);
    logDiagnostic("LIVE", `news sources inactive · restored defaults ${sources.length}`);
  }
  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    NEWS_TIMEOUT_MS,
  );
  try {
    const snapshots = await Promise.all(sources.map(async (source) => {
      const endpoint = source.feed
        ? `/api/news?feed=${source.feed}`
        : `/api/news?url=${encodeURIComponent(source.url)}`;
      try {
        const response = await fetchImpl(endpoint, {
          headers: {
            accept: "application/rss+xml, application/xml, text/xml",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          logDiagnostic("ERROR", `news source ${source.id} failed · ${response.status}`);
          return [];
        }
        return parseNewsFeed(await response.text(), source);
      } catch {
        logDiagnostic("ERROR", `news source ${source.id} request failed`);
        return [];
      }
    }));
    const items = snapshots.reduce<readonly NewsItem[]>(
      (all, snapshot) => mergeNewsItems(snapshot, all),
      [],
    );
    if (items.length === 0) throw new Error("NEWS_EMPTY");

    const value = mergeNewsItems(items, usableCache?.value ?? []);
    logDiagnostic(
      "LIVE",
      `news merged · network ${items.length} · total ${value.length}`,
    );
    const cache: NewsCache = { value, fetchedAt: now };
    await writeCache(storage, "news", cache);
    return {
      status: "fresh",
      value: cloneItems(value),
      fetchedAt: now,
    };
  } catch {
    return usableCache
      ? toState(usableCache, "stale")
      : { status: "unavailable" };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
