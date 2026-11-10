import { describe, expect, it } from "vitest";
import { BUILT_IN_RSS_FEEDS } from "../server/news-feeds.js";
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from "./i18n/locale-registry";
import type { EvenStorage } from "./live-cache";
import {
  DEFAULT_RSS_SOURCE,
  addRssSource,
  defaultRssSources,
  deleteRssSource,
  resolveRssSources,
  updateRssSource,
  validateRssSourceUrl,
  writeRssSources,
} from "./rss-sources";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.values.set(key, value);
    return true;
  }
}

describe("RSS source preferences", () => {
  it("shares one valid three-feed catalog for every supported locale", () => {
    expect(BUILT_IN_RSS_FEEDS).toHaveLength(540);
    expect(new Set(BUILT_IN_RSS_FEEDS.map(({ id }) => id)).size)
      .toBe(BUILT_IN_RSS_FEEDS.length);
    const localized = BUILT_IN_RSS_FEEDS.filter((feed) => !feed.fallbackLocale);
    expect(new Set(localized.map(({ url }) => url)).size)
      .toBe(localized.length);
    for (const feed of BUILT_IN_RSS_FEEDS) {
      expect(isSupportedLocale(feed.locale)).toBe(true);
      expect(new URL(feed.url).protocol).toBe("https:");
    }
    for (const locale of SUPPORTED_LOCALES) {
      expect(BUILT_IN_RSS_FEEDS.filter((feed) => feed.locale === locale))
        .toHaveLength(3);
    }
  });

  it("seeds three enabled non-deletable sources for each locale", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      await expect(resolveRssSources(new TestStorage(), locale))
        .resolves.toEqual(defaultRssSources(locale));
      expect(defaultRssSources(locale)).toHaveLength(3);
    }
    expect(DEFAULT_RSS_SOURCE).toMatchObject({
      id: "sbs-latest",
      name: "SBS 최신뉴스",
      enabled: true,
      isDefault: true,
      locale: "ko",
      feed: "sbs-latest",
    });
  });

  it("accepts only public-looking HTTPS URLs on the client", () => {
    expect(validateRssSourceUrl("https://example.com/feed.xml")).toEqual({
      ok: true,
      value: "https://example.com/feed.xml",
    });
    expect(validateRssSourceUrl("http://example.com/feed.xml").ok).toBe(false);
    expect(validateRssSourceUrl("https://localhost/feed.xml").ok).toBe(false);
    expect(validateRssSourceUrl("https://127.0.0.1/feed.xml").ok).toBe(false);
  });

  it.each([
    "https://localhost./feed.xml",
    "https://reader.local./feed.xml",
    "https://feeds.internal/feed.xml",
    "https://router.home/feed.xml",
    "https://router.lan/feed.xml",
    "https://printer/feed.xml",
  ])("rejects private hostname variants: %s", (url) => {
    expect(validateRssSourceUrl(url)).toEqual({ ok: false, code: "unsafe" });
  });

  it("adds up to six custom sources and never deletes a built-in", () => {
    let sources = [...defaultRssSources("ko")];
    for (let index = 0; index < 6; index += 1) {
      sources = [...addRssSource(
        sources,
        `Feed ${index}`,
        `https://example${index}.com/feed.xml`,
      )];
    }
    expect(sources).toHaveLength(9);
    expect(() => addRssSource(
      sources,
      "Overflow",
      "https://overflow.example/feed.xml",
    )).toThrowError("rss_source_limit");
    expect(deleteRssSource(sources, "sbs-latest")).toEqual(sources);
    expect(deleteRssSource(sources, "newsis-breaking")).toEqual(sources);
  });

  it("persists locale-specific built-in settings and shared custom sources", async () => {
    const storage = new TestStorage();
    const korean = addRssSource(
      updateRssSource(
        defaultRssSources("ko"),
        "newsis-breaking",
        { enabled: false },
      ),
      "Example",
      "https://example.com/feed.xml",
    );
    await expect(writeRssSources(storage, korean, "ko")).resolves.toBe(true);

    const english = await resolveRssSources(storage, "en");
    expect(english.slice(0, 3)).toEqual(defaultRssSources("en"));
    expect(english.at(-1)?.name).toBe("Example");
    await expect(writeRssSources(
      storage,
      updateRssSource(english, "bbc-world", { enabled: false }),
      "en",
    )).resolves.toBe(true);

    await expect(resolveRssSources(storage, "ko")).resolves.toEqual(korean);
    expect((await resolveRssSources(storage, "en"))[0].enabled).toBe(false);
  });

  it("migrates the legacy single SBS record without losing custom feeds", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:rss-sources:v1", JSON.stringify([
      {
        id: "sbs-latest",
        name: "My SBS",
        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
        enabled: false,
        isDefault: true,
      },
      {
        id: "example",
        name: "Example",
        url: "https://example.com/feed.xml",
        enabled: true,
        isDefault: false,
      },
    ]));

    const resolved = await resolveRssSources(storage, "ko");

    expect(resolved).toHaveLength(4);
    expect(resolved[0]).toMatchObject({
      id: "sbs-latest",
      name: "My SBS",
      enabled: false,
      feed: "sbs-latest",
      locale: "ko",
    });
    expect(resolved.at(-1)?.id).toBe("example");
  });
});

describe("retired feed migration",()=>{
 it.each(["주간경향 최신기사","My custom name"])("preserves disabled state and custom feeds when replacing %s",async name=>{
  const storage=new TestStorage();const builtins=defaultRssSources("ko").map(source=>source.id==="ohmynews-latest"?{
   ...source,id:"weekly-khan-latest",feed:"weekly-khan-latest",name,url:"https://weekly.khan.co.kr/rss/rssdata/total_news.xml",enabled:false,
  }:source);
  storage.values.set("sandevistan:rss-sources:v1",JSON.stringify([...builtins,{id:"personal",name:"Personal",url:"https://example.com/feed.xml",enabled:true,isDefault:false}]));
  const resolved=await resolveRssSources(storage,"ko");expect(resolved).toHaveLength(4);
  expect(resolved.find(x=>x.id==="ohmynews-latest")).toMatchObject({enabled:false,name:name==="My custom name"?name:defaultRssSources("ko").find(x=>x.id==="ohmynews-latest")?.name});
  expect(resolved.find(x=>x.id==="personal")?.name).toBe("Personal");
 });
});
