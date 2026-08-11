import { BUILT_IN_RSS_FEEDS } from "../server/news-feeds.js";

const X_API_ORIGIN = "https://api.x.com";
const MAX_TOKEN_LENGTH = 4096;
const MAX_NEWS_BYTES = 1_000_000;
const ALLOWED_PATHS = [
  /^\/2\/users\/me$/,
  /^\/2\/users\/\d+\/timelines\/reverse_chronological$/,
];
const NEWS_FEEDS = new Map(BUILT_IN_RSS_FEEDS.map(({ id, url }) => [id, url]));
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
};

function response(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function isAllowedPath(pathname) {
  return ALLOWED_PATHS.some((pattern) => pattern.test(pathname));
}

function xMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "pbs.twimg.com"
      && url.pathname.startsWith("/media/")
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function validAuthorization(value) {
  return value?.startsWith("Bearer ")
    && value.length <= MAX_TOKEN_LENGTH
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function relayResponse(upstream) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}

function newsResponse(upstream) {
  const length = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_NEWS_BYTES) {
    return response({ error: "news_too_large" }, 502);
  }
  const headers = new Headers(CORS_HEADERS);
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/xml; charset=utf-8");
  headers.set("cache-control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "GET") return response({ error: "method_not_allowed" }, 405);

    const url = new URL(request.url);
    if (url.pathname === "/media") {
      const media = xMediaUrl(url.searchParams.get("url"));
      if (!media || [...url.searchParams.keys()].some((key) => key !== "url")) {
        return response({ error: "x_media_not_allowed" }, 404);
      }
      try {
        const upstream = await fetch(media);
        if (!upstream.ok) return response({ error: "x_media_unavailable" }, 502);
        const headers = new Headers(CORS_HEADERS);
        headers.set("content-type", upstream.headers.get("content-type") ?? "image/jpeg");
        headers.set("cache-control", "public, max-age=86400");
        return new Response(upstream.body, { status: 200, headers });
      } catch {
        return response({ error: "x_media_unavailable" }, 502);
      }
    }
    if (url.pathname === "/news") {
      const feed = NEWS_FEEDS.get(url.searchParams.get("feed"));
      if (!feed || [...url.searchParams.keys()].some((key) => key !== "feed")) {
        return response({ error: "news_feed_not_allowed" }, 404);
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const upstream = await fetch(feed, {
          headers: { accept: "application/rss+xml, application/xml, text/xml" },
          signal: controller.signal,
        });
        return upstream.ok
          ? newsResponse(upstream)
          : response({ error: "news_upstream_unavailable" }, 502);
      } catch {
        return response({ error: "news_upstream_unavailable" }, 502);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!isAllowedPath(url.pathname)) return response({ error: "x_route_not_allowed" }, 404);

    const authorization = request.headers.get("authorization");
    if (!validAuthorization(authorization)) return response({ error: "invalid_authorization" }, 401);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const upstream = await fetch(`${X_API_ORIGIN}${url.pathname}${url.search}`, {
        headers: { authorization, accept: "application/json" },
        signal: controller.signal,
      });
      return relayResponse(upstream);
    } catch {
      return response({ error: "x_upstream_unavailable" }, 502);
    } finally {
      clearTimeout(timeout);
    }
  },
};
