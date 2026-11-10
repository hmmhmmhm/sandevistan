import { privacyResponse } from "../server/privacy.js";
import { jsonResponse } from "../server/http.js";
import { handleVectorMapRequest } from "../server/vector-map.js";
import { handleNewsRequest } from "../server/news.js";
import { handleGeocodeRequest, handleRouteRequest, handleRoutingKeyTest, handleRoutingStatus } from "../server/route.js";

import { publicApiGuard, publicApiReady, recordPublicApiStatus } from "../server/public-api-controls.js";

const routes = new Map([
  ["/api/news", { method: "GET", handle: handleNewsRequest }],
  ["/api/map", { method: "GET", handle: handleVectorMapRequest }],
  ["/api/routing-status", { method: "GET", handle: handleRoutingStatus }],
  ["/api/routing-key-test", { method: "POST", handle: handleRoutingKeyTest }],
  ["/api/geocode", { method: "GET", handle: handleGeocodeRequest }],
  ["/api/route", { method: "POST", handle: handleRouteRequest }],
]);
function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, x-sandevistan-ors-key");
  headers.set("access-control-max-age", "600");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
export async function handlePublicApiRequest(request, env = {}, dependencies = {}) {
  const path = new URL(request.url).pathname;
  if (path === "/privacy" && request.method === "GET") return privacyResponse();
  if (path === "/api/health" && request.method === "GET") {
    const ok = publicApiReady(env);
    return cors(jsonResponse({ service: "sandevistan-api", version: "2026-11-09", ok }, { status: ok ? 200 : 503 }));
  }
  const route = routes.get(path);
  if (!route) return cors(jsonResponse({ error: { code: "API_NOT_FOUND" } }, { status: 404 }));
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (request.method !== route.method) {
    return cors(jsonResponse({ error: { code: "METHOD_NOT_ALLOWED" } }, { status: 405 }));
  }
  let response;
  try {
    response = await publicApiGuard(request, env) || await route.handle(request, env, dependencies);
  } catch {
    response = jsonResponse({ error: { code: "API_UNAVAILABLE" } }, { status: 502 });
  }
  recordPublicApiStatus(env, path, response.status);
  return cors(response);
}
export default { fetch: handlePublicApiRequest };
