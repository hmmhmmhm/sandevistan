const X_API_ORIGIN = "https://api.x.com";
const MAX_TOKEN_LENGTH = 4096;
const ALLOWED_PATHS = [
  /^\/2\/users\/me$/,
  /^\/2\/users\/\d+\/timelines\/reverse_chronological$/,
];
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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "GET") return response({ error: "method_not_allowed" }, 405);

    const url = new URL(request.url);
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
