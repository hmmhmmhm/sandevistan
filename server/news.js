import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";
import { BUILT_IN_RSS_FEEDS } from "./news-feeds.js";

const FEEDS = new Map(
  BUILT_IN_RSS_FEEDS.map(({ id, url }) => [id, url]),
);
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const XML_CONTENT_TYPE = /^(?:application\/(?:atom\+xml|rss\+xml|xml)|text\/xml)(?:;|$)/i;
const PRIVATE_SUFFIXES = [
  ".internal",
  ".local",
  ".localhost",
  ".home",
  ".lan",
];

function newsError(code, message, status) {
  return jsonResponse({ error: { code, message } }, { status });
}

function customFeedUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.+$/, "");
    const isIpLiteral = hostname.includes(":")
      || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.hash
      || (url.port && url.port !== "443")
      || !hostname
      || !hostname.includes(".")
      || hostname === "localhost"
      || isIpLiteral
      || PRIVATE_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeFeed(bytes) {
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  const withoutPreamble = text
    .replace(/^\s*<\?xml[\s\S]*?\?>/i, "")
    .replace(/^\s*<!--[\s\S]*?-->/, "")
    .trimStart();
  return /^<(?:rss|feed|(?:[A-Za-z_][\w.-]*:)?RDF)(?:\s|>)/i
    .test(withoutPreamble);
}

export async function handleNewsRequest(
  request,
  _env,
  {
    fetchImpl = fetch,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const requestUrl = new URL(request.url);
  const fixedFeed = FEEDS.get(requestUrl.searchParams.get("feed"));
  const customParameter = requestUrl.searchParams.get("url");
  const customFeed = customFeedUrl(customParameter);
  if (customParameter && customFeed === null) {
    return newsError("UNSAFE_FEED_URL", "Unsafe news feed URL", 400);
  }
  const feed = fixedFeed ?? customFeed;
  if (!feed) {
    return newsError(
      "UNSUPPORTED_FEED",
      "Unsupported news feed",
      400,
    );
  }

  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(feed, {
      redirect: "manual",
      headers: {
        accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: timeout.signal,
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return newsError(
        "NEWS_REDIRECT",
        "News upstream redirects are not allowed",
        502,
      );
    }
    if (!upstream.ok) {
      return newsError(
        "NEWS_UPSTREAM_ERROR",
        "News upstream request failed",
        502,
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!XML_CONTENT_TYPE.test(contentType)) {
      await upstream.body?.cancel();
      return newsError(
        "NEWS_CONTENT_TYPE",
        "News upstream did not return XML",
        502,
      );
    }
    const bytes = await readLimitedBytes(upstream, MAX_BYTES);
    if (!looksLikeFeed(bytes)) {
      return newsError(
        "NEWS_INVALID_FEED",
        "News upstream did not return an RSS or Atom feed",
        502,
      );
    }
    const custom = customFeed !== undefined;
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": custom
          ? "application/xml; charset=utf-8"
          : "application/rss+xml; charset=utf-8",
        "cache-control": custom
          ? "no-store"
          : "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (timeout.signal.aborted || error?.name === "AbortError") {
      return newsError("NEWS_TIMEOUT", "News request timed out", 504);
    }
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      return newsError("NEWS_TOO_LARGE", "News response is too large", 502);
    }
    return newsError(
      "NEWS_UPSTREAM_ERROR",
      "News upstream request failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}
