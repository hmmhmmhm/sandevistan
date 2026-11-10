import { jsonResponse } from './http.js';

export function publicApiReady(env) {
  return env.PUBLIC_API_ENABLED !== 'false' &&
    (env.REQUIRE_PUBLIC_API_LIMITER !== 'true' || typeof env.PUBLIC_API_RATE_LIMITER?.limit === 'function');
}
export async function publicApiGuard(request, env) {
  if (!publicApiReady(env)) return jsonResponse({ error: { code: 'API_UNAVAILABLE' } }, { status: 503 });
  if (!env.PUBLIC_API_RATE_LIMITER) return null;
  try {
    const key = request.headers.get('cf-connecting-ip') || 'unknown';
    const result = await env.PUBLIC_API_RATE_LIMITER.limit({ key });
    if (result.success) return null;
    return jsonResponse({ error: { code: 'RATE_LIMITED' } }, { status: 429, headers: { 'retry-after': '60' } });
  } catch {
    return jsonResponse({ error: { code: 'API_UNAVAILABLE' } }, { status: 503 });
  }
}
export function recordPublicApiStatus(env, path, status) {
  try {
    env.PUBLIC_API_EVENTS?.writeDataPoint({ indexes: ['public-api'], blobs: [path, String(status)], doubles: [1] });
  } catch {}
}
