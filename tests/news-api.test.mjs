import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";
import { BUILT_IN_RSS_FEEDS } from "../server/news-feeds.js";
import { handleNewsRequest } from "../server/news.js";

const FIXED_FEEDS = new Map(
  BUILT_IN_RSS_FEEDS.map(({ id, url }) => [id, url]),
);
const FEED_URL = FIXED_FEEDS.get("sbs-latest");

test("uses unique fixed feed IDs and explicit shared fallback URLs", () => {
  assert.equal(BUILT_IN_RSS_FEEDS.length, 540);
  assert.equal(FIXED_FEEDS.size, BUILT_IN_RSS_FEEDS.length);
  const localized = BUILT_IN_RSS_FEEDS.filter((feed) => !feed.fallbackLocale);
  assert.equal(
    new Set(localized.map(({ url }) => url)).size,
    localized.length,
  );
  const englishUrls = new Set(
    BUILT_IN_RSS_FEEDS
      .filter((feed) => feed.locale === "en")
      .map(({ url }) => url),
  );
  for (const feed of BUILT_IN_RSS_FEEDS.filter((item) => item.fallbackLocale)) {
    assert.equal(feed.fallbackLocale, "en");
    assert.equal(englishUrls.has(feed.url), true);
  }
});

function rssResponse(body = "<rss><channel /></rss>", init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/rss+xml" },
    ...init,
  });
}

test("proxies only the fixed SBS latest feed with hardened options", async () => {
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return rssResponse("<rss>ok</rss>");
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<rss>ok</rss>");
  assert.equal(
    response.headers.get("content-type"),
    "application/rss+xml; charset=utf-8",
  );
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FEED_URL);
  assert.equal(calls[0].options.redirect, "manual");
  assert.deepEqual(calls[0].options.headers, {
    accept: "application/rss+xml, application/xml, text/xml",
  });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

for (const [feed, url] of FIXED_FEEDS) {
  test(`proxies the fixed ${feed} feed`, async () => {
    const calls = [];
    const response = await handleNewsRequest(
      new Request(`https://example.test/api/news?feed=${feed}`),
      {},
      {
        fetchImpl: async (input) => {
          calls.push(input);
          return rssResponse();
        },
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls, [url]);
  });
}

test("proxies one validated custom HTTPS RSS feed without shared caching", async () => {
  const calls = [];
  const source = "https://feeds.example.com/latest.xml?edition=kr";
  const response = await handleApiRequest(
    new Request(
      `https://example.test/api/news?url=${encodeURIComponent(source)}`,
    ),
    {},
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return rssResponse("<feed xmlns=\"http://www.w3.org/2005/Atom\" />", {
          headers: { "content-type": "application/atom+xml" },
        });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, source);
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    response.headers.get("content-type"),
    "application/xml; charset=utf-8",
  );
});

for (const unsafe of [
  "http://feeds.example.com/rss.xml",
  "https://user:pass@feeds.example.com/rss.xml",
  "https://feeds.example.com:8443/rss.xml",
  "https://127.0.0.1/rss.xml",
  "https://[::1]/rss.xml",
  "https://localhost/rss.xml",
  "https://localhost./rss.xml",
  "https://reader.local./rss.xml",
  "https://printer/rss.xml",
  "https://reader.local/rss.xml",
  "https://feeds.internal/rss.xml",
  "https://feeds.example.com/rss.xml#private",
]) {
  test(`rejects unsafe custom RSS URL ${unsafe}`, async () => {
    let calls = 0;
    const response = await handleNewsRequest(
      new Request(
        `https://example.test/api/news?url=${encodeURIComponent(unsafe)}`,
      ),
      {},
      { fetchImpl: async () => {
        calls += 1;
        return rssResponse();
      } },
    );

    assert.equal(response.status, 400);
    assert.equal(calls, 0);
    assert.equal((await response.json()).error.code, "UNSAFE_FEED_URL");
  });
}

test("rejects custom redirects, non-XML content, and non-feed XML", async () => {
  const source = encodeURIComponent("https://feeds.example.com/rss.xml");
  const redirect = await handleNewsRequest(
    new Request(`https://example.test/api/news?url=${source}`),
    {},
    { fetchImpl: async () => new Response(null, {
      status: 302,
      headers: { location: "https://other.example.com/rss.xml" },
    }) },
  );
  const html = await handleNewsRequest(
    new Request(`https://example.test/api/news?url=${source}`),
    {},
    { fetchImpl: async () => new Response("<rss />", {
      headers: { "content-type": "text/html" },
    }) },
  );
  const nonFeed = await handleNewsRequest(
    new Request(`https://example.test/api/news?url=${source}`),
    {},
    { fetchImpl: async () => new Response("<document />", {
      headers: { "content-type": "application/xml" },
    }) },
  );

  assert.equal(redirect.status, 502);
  assert.equal((await redirect.json()).error.code, "NEWS_REDIRECT");
  assert.equal(html.status, 502);
  assert.equal((await html.json()).error.code, "NEWS_CONTENT_TYPE");
  assert.equal(nonFeed.status, 502);
  assert.equal((await nonFeed.json()).error.code, "NEWS_INVALID_FEED");
});

test("rejects unsupported feeds without calling upstream", async () => {
  let calls = 0;
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=unknown"),
    {},
    { fetchImpl: async () => {
      calls += 1;
      return rssResponse();
    } },
  );

  assert.equal(response.status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), {
    error: {
      code: "UNSUPPORTED_FEED",
      message: "Unsupported news feed",
    },
  });
});

test("leaves non-GET news requests to the API 404", async () => {
  let calls = 0;
  const response = await handleApiRequest(
    new Request("https://example.test/api/news?feed=sbs-latest", {
      method: "POST",
    }),
    {},
    { fetchImpl: async () => {
      calls += 1;
      return rssResponse();
    } },
  );

  assert.equal(response.status, 404);
  assert.equal(calls, 0);
  assert.equal((await response.json()).error.code, "API_NOT_FOUND");
});

test("maps an upstream non-2xx response to a stable JSON error", async () => {
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    { fetchImpl: async () => new Response("bad", { status: 503 }) },
  );

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "NEWS_UPSTREAM_ERROR");
});

test("cancels and rejects a response larger than one million bytes", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(600_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      fetchImpl: async () => new Response(body, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    },
  );

  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "NEWS_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("maps the eight-second abort to NEWS_TIMEOUT and clears its timer", async () => {
  const cleared = [];
  const response = await handleNewsRequest(
    new Request("https://example.test/api/news?feed=sbs-latest"),
    {},
    {
      setTimeoutImpl: (callback, milliseconds) => {
        assert.equal(milliseconds, 8_000);
        callback();
        return 42;
      },
      clearTimeoutImpl: (timer) => cleared.push(timer),
      fetchImpl: async (_url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      },
    },
  );

  assert.equal(response.status, 504);
  assert.equal((await response.json()).error.code, "NEWS_TIMEOUT");
  assert.deepEqual(cleared, [42]);
});
