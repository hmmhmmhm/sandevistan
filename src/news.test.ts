// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "./live-cache";
import type { NewsItem } from "./live-state";
import {
  NEWS_LIMIT,
  NEWS_MAX_AGE_MS,
  mergeNewsItems,
  parseNewsFeed,
  parseNewsRss,
  resolveNews,
} from "./news";

const NOW = Date.parse("2026-07-27T06:00:00Z");
const ITEMS: readonly NewsItem[] = [
  {
    id: "guid:new",
    title: "첫 번째 최신 기사",
    url: "https://news.sbs.co.kr/a",
    publishedAt: Date.parse("2026-07-27T05:00:00Z"),
    summary: "첫 문장 요약입니다. 두 번째 문장입니다.",
  },
];

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[<b>첫 번째</b> 최신 기사]]></title>
    <guid>new</guid>
    <link>https://news.sbs.co.kr/a</link>
    <pubDate>Mon, 27 Jul 2026 05:00:00 GMT</pubDate>
    <description><![CDATA[
      <p>첫 문장&nbsp;요약입니다.</p>
      <script>제거할 코드</script>
      두 번째 문장입니다.
    ]]></description>
  </item>
  <item>
    <title>중복된 이전 기사</title>
    <guid>new</guid>
    <pubDate>Mon, 27 Jul 2026 04:00:00 GMT</pubDate>
  </item>
  <item>
    <title>두 번째 &amp; 주요 기사</title>
    <guid>two</guid>
    <pubDate>Mon, 27 Jul 2026 04:30:00 GMT</pubDate>
  </item>
  <item><title>세 번째 기사</title><link>https://news.sbs.co.kr/c</link></item>
  <item><title>네 번째 기사</title></item>
  <item><title>다섯 번째 기사</title><guid>five</guid></item>
  <item><title>여섯 번째 기사</title><guid>six</guid></item>
  <item><title>일곱 번째 제외 기사</title><guid>seven</guid></item>
</channel></rss>`;

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  constructor(
    private readonly mode: "working" | "read-fails" | "write-fails" =
      "working",
  ) {}

  async getLocalStorage(key: string): Promise<string> {
    if (this.mode === "read-fails") throw new Error("read failed");
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.mode === "write-fails") throw new Error("write failed");
    this.values.set(key, value);
    return true;
  }
}

function xmlFetch(
  xml: string,
  options: { ok?: boolean; rejects?: boolean } = {},
): typeof fetch {
  return vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (options.rejects) throw new Error("network failed");
    return {
      ok: options.ok ?? true,
      text: async () => xml,
      signal: init?.signal,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function setCache(
  storage: TestStorage,
  value: readonly NewsItem[],
  fetchedAt: number,
) {
  storage.values.set(
    "sandevistan:news:v1",
    JSON.stringify({ value, fetchedAt }),
  );
}

function rssWithItems(count: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      ${Array.from({ length: count }, (_, index) => `
        <item>
          <title>기사 ${index + 1}</title>
          <guid>item-${index + 1}</guid>
          <pubDate>${new Date(NOW - index * 60_000).toUTCString()}</pubDate>
        </item>
      `).join("")}
    </channel></rss>`;
}

afterEach(() => vi.useRealTimers());

describe("parseNewsRss", () => {
  it("parses Atom entries with a sanitized source label", () => {
    const items = parseNewsFeed(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>tag:example.com,2026:item-1</id>
          <title>Atom &amp; Headline</title>
          <link rel="alternate" href="https://example.com/item-1" />
          <updated>2026-07-27T05:30:00Z</updated>
          <summary><![CDATA[<p>Atom summary</p>]]></summary>
        </entry>
      </feed>`, {
      id: "example",
      name: "Example Feed",
    });

    expect(items).toEqual([{
      id: "guid:tag:example.com,2026:item-1",
      title: "Atom & Headline",
      url: "https://example.com/item-1",
      publishedAt: Date.parse("2026-07-27T05:30:00Z"),
      summary: "Atom summary",
      source: "Example Feed",
    }]);
  });

  it("sanitizes, deduplicates, and sorts all available headlines", () => {
    const items = parseNewsRss(RSS);

    expect(items[0]).toEqual(ITEMS[0]);
    expect(items).toHaveLength(7);
    expect(items.map(({ title }) => title)).toEqual([
      "첫 번째 최신 기사",
      "두 번째 & 주요 기사",
      "세 번째 기사",
      "네 번째 기사",
      "다섯 번째 기사",
      "여섯 번째 기사",
      "일곱 번째 제외 기사",
    ]);
    expect(items.every(({ title }) => !/[<>]/.test(title))).toBe(true);
  });

  it("limits one RSS snapshot to one hundred articles", () => {
    const items = parseNewsRss(rssWithItems(NEWS_LIMIT + 1));

    expect(items).toHaveLength(NEWS_LIMIT);
    expect(items.at(-1)?.id).toBe("guid:item-100");
  });

  it("removes active markup and limits summaries to 360 code points", () => {
    const longSummary = "가".repeat(361);
    const items = parseNewsRss(`<?xml version="1.0"?>
      <rss><channel><item>
        <title>긴 기사</title>
        <description><![CDATA[${longSummary}]]></description>
      </item></channel></rss>`);

    expect(items[0].summary).toHaveLength(360);
    expect(items[0].summary).not.toContain("제거할 코드");
  });

  it("returns an empty list for malformed XML or no usable titles", () => {
    expect(parseNewsRss("<not-rss>")).toEqual([]);
    expect(parseNewsRss("<rss><channel><item><title> </title></item></channel></rss>"))
      .toEqual([]);
  });

  it("uses link then a deterministic title hash when guid is absent", () => {
    const items = parseNewsRss(`<?xml version="1.0"?>
      <rss><channel>
        <item><title>링크 기사</title><link>https://news.sbs.co.kr/link</link></item>
        <item><title>제목 전용 기사</title></item>
      </channel></rss>`);

    expect(items[0].id).toBe("link:https://news.sbs.co.kr/link");
    expect(items[1].id).toMatch(/^title:[0-9a-f]{8}$/);
  });

  it("merges new articles ahead of cached duplicates and caps the library", () => {
    const cached = Array.from({ length: NEWS_LIMIT }, (_, index) => ({
      id: `cached-${index}`,
      title: `캐시 기사 ${index}`,
      publishedAt: NOW - (index + 1) * 60_000,
    }));

    const merged = mergeNewsItems([
      { id: "new", title: "새 기사", publishedAt: NOW },
      {
        id: "cached-0",
        title: "갱신된 캐시 기사",
        publishedAt: NOW - 30_000,
      },
    ], cached);

    expect(merged).toHaveLength(NEWS_LIMIT);
    expect(merged.slice(0, 3).map(({ id }) => id)).toEqual([
      "new",
      "cached-0",
      "cached-1",
    ]);
    expect(merged[1].title).toBe("갱신된 캐시 기사");
    expect(merged.some(({ id }) => id === `cached-${NEWS_LIMIT - 1}`))
      .toBe(false);
  });
});

describe("resolveNews", () => {
  it("uses the three built-in feed aliases for the selected locale", async () => {
    const storage = new TestStorage();
    const fetchImpl = xmlFetch(RSS);

    await resolveNews(storage, fetchImpl, NOW, undefined, false, "en");

    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input)))
      .toEqual([
        "/api/news?feed=bbc-world",
        "/api/news?feed=guardian-world",
        "/api/news?feed=lemonde-international",
      ]);
  });

  it("fetches every enabled stored source and merges labelled results", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:rss-sources:v1", JSON.stringify([
      {
        id: "sbs-latest",
        name: "SBS Latest",
        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
        enabled: true,
        isDefault: true,
      },
      {
        id: "example",
        name: "Example",
        url: "https://feeds.example.com/atom.xml",
        enabled: true,
        isDefault: false,
      },
    ]));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("feed=sbs-latest")) {
        return {
          ok: true,
          text: async () => RSS,
        } as Response;
      }
      return {
        ok: true,
        text: async () => `<feed xmlns="http://www.w3.org/2005/Atom">
          <entry><id>atom-one</id><title>Atom article</title></entry>
        </feed>`,
      } as Response;
    }) as typeof fetch;

    const result = await resolveNews(storage, fetchImpl, NOW);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input)))
      .toContain(
        "/api/news?url=https%3A%2F%2Ffeeds.example.com%2Fatom.xml",
      );
    expect(result.value?.some((item) => (
      item.title === "Atom article" && item.source === "Example"
    ))).toBe(true);
    expect(result.value?.some((item) => item.source === "SBS Latest"))
      .toBe(true);
  });

  it("restores the locale defaults when a stored source list has no enabled source", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:rss-sources:v1", JSON.stringify([
      {
        id: "sbs-latest",
        name: "SBS Latest",
        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
        enabled: false,
        isDefault: true,
      },
      {
        id: "newsis-breaking",
        name: "Newsis",
        url: "https://www.newsis.com/RSS/sokbo.xml",
        enabled: false,
        isDefault: true,
      },
      {
        id: "weekly-khan-latest",
        name: "Khan",
        url: "https://weekly.khan.co.kr/rss/rssdata/total_news.xml",
        enabled: false,
        isDefault: true,
      },
    ]));
    const fetchImpl = xmlFetch(RSS);

    await expect(resolveNews(storage, fetchImpl, NOW)).resolves.toMatchObject({
      status: "fresh",
    });
    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input)))
      .toEqual([
        "/api/news?feed=sbs-latest",
        "/api/news?feed=newsis-breaking",
        "/api/news?feed=weekly-khan-latest",
      ]);
  });

  it("returns a fresh cache immediately without fetching", async () => {
    const storage = new TestStorage();
    setCache(storage, ITEMS, NOW - NEWS_MAX_AGE_MS);
    const fetchImpl = vi.fn();
    const cached = vi.fn();

    const result = await resolveNews(
      storage,
      fetchImpl as typeof fetch,
      NOW,
      cached,
    );

    expect(result).toEqual({
      status: "fresh",
      value: ITEMS,
      fetchedAt: NOW - NEWS_MAX_AGE_MS,
    });
    expect(cached).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows stale cache before refreshing it", async () => {
    const storage = new TestStorage();
    setCache(storage, [{
      id: "cached-only",
      title: "이전 기사",
      publishedAt: NOW - NEWS_MAX_AGE_MS,
    }], NOW - NEWS_MAX_AGE_MS - 1);
    const order: string[] = [];
    const fetchImpl = vi.fn(async () => {
      order.push("fetch");
      return { ok: true, text: async () => RSS } as Response;
    }) as unknown as typeof fetch;

    const result = await resolveNews(
      storage,
      fetchImpl,
      NOW,
      (cached) => {
        order.push("cache");
        expect(cached.status).toBe("stale");
      },
    );

    expect(order).toEqual(["cache", "fetch", "fetch", "fetch"]);
    expect(result.status).toBe("fresh");
    expect(result.value?.[0].title).toBe("첫 번째 최신 기사");
    expect(result.value?.some(({ id }) => id === "cached-only")).toBe(true);
  });

  it("keeps stale headlines on refresh failure", async () => {
    const storage = new TestStorage();
    setCache(storage, ITEMS, NOW - NEWS_MAX_AGE_MS - 1);

    await expect(
      resolveNews(storage, xmlFetch("", { rejects: true }), NOW),
    ).resolves.toEqual({
      status: "stale",
      value: ITEMS,
      fetchedAt: NOW - NEWS_MAX_AGE_MS - 1,
    });
  });

  it("returns unavailable when no cache and refresh fails or parses empty", async () => {
    const storage = new TestStorage();

    await expect(
      resolveNews(storage, xmlFetch("", { rejects: true }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(storage, xmlFetch("<rss><channel /></rss>"), NOW),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("ignores corrupt and future caches", async () => {
    const corrupt = new TestStorage();
    corrupt.values.set("sandevistan:news:v1", "{bad");
    const invalidSummary = new TestStorage();
    setCache(
      invalidSummary,
      [{ ...ITEMS[0], summary: "가".repeat(361) }],
      NOW,
    );
    const controlSummary = new TestStorage();
    setCache(
      controlSummary,
      [{ ...ITEMS[0], summary: "제어\u0007문자" }],
      NOW,
    );
    const future = new TestStorage();
    setCache(future, ITEMS, NOW + 1);
    const oversized = new TestStorage();
    setCache(
      oversized,
      Array.from({ length: NEWS_LIMIT + 1 }, (_, index) => ({
        id: `oversized-${index}`,
        title: `초과 기사 ${index}`,
      })),
      NOW,
    );

    await expect(
      resolveNews(corrupt, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(future, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(invalidSummary, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(controlSummary, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      resolveNews(oversized, xmlFetch("", { ok: false }), NOW),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("persists the normalized library and survives storage failures", async () => {
    const storage = new TestStorage();
    const writeFailure = new TestStorage("write-fails");
    const readFailure = new TestStorage("read-fails");

    const result = await resolveNews(storage, xmlFetch(RSS), NOW);
    expect(storage.writes).toEqual([[
      "sandevistan:news:v1",
      JSON.stringify({ value: result.value, fetchedAt: NOW }),
    ]]);
    await expect(resolveNews(writeFailure, xmlFetch(RSS), NOW))
      .resolves.toMatchObject({ status: "fresh" });
    await expect(resolveNews(readFailure, xmlFetch("", { ok: false }), NOW))
      .resolves.toEqual({ status: "unavailable" });
  });

  it("aborts after eight seconds and clears the timer", async () => {
    vi.useFakeTimers();
    const storage = new TestStorage();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    const pending = resolveNews(storage, fetchImpl, NOW);
    await vi.advanceTimersByTimeAsync(8_000);

    await expect(pending).resolves.toEqual({ status: "unavailable" });
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
