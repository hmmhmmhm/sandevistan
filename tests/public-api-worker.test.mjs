import assert from "node:assert/strict";
import test from "node:test";
import { handlePublicApiRequest } from "../worker/api.js";
const host = "https://sandevistan-api.example";
test("answers packaged-WebView CORS preflight without cookies or credentials", async () => {
  const response = await handlePublicApiRequest(new Request(host + "/api/route", { method: "OPTIONS", headers: {
    origin: "null", "access-control-request-method": "POST", "access-control-request-headers": "content-type,x-sandevistan-ors-key",
  } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("access-control-allow-headers"), /x-sandevistan-ors-key/);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
});
test("exposes health and public APIs without exposing AI key proxy endpoints", async () => {
  const health = await handlePublicApiRequest(new Request(host + "/api/health"));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "sandevistan-api");
  for (const path of ["/api/realtime-token", "/api/ai-web-search", "/api/conversate-analyze", "/unrelated"]) {
    const response = await handlePublicApiRequest(new Request(host + path));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
  }
});
test("reuses the validated RSS handler and returns CORS on errors too", async () => {
  const xml = '<rss version="2.0"><channel><item><title>News</title></item></channel></rss>';
  const response = await handlePublicApiRequest(new Request(host + "/api/news?feed=bbc-world"), {}, {
    fetchImpl: async () => new Response(xml, { headers: { "content-type": "application/rss+xml" } }),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), xml);
  const invalid = await handlePublicApiRequest(new Request(host + "/api/news?url=http://127.0.0.1"));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.headers.get("access-control-allow-origin"), "*");
});
test("keeps optional routing disabled without a user-owned key", async () => {
  const response = await handlePublicApiRequest(new Request(host + "/api/routing-status"));
  assert.deepEqual(await response.json(), { enabled: false });
  const wrongMethod = await handlePublicApiRequest(new Request(host + "/api/news", { method: "POST" }));
  assert.equal(wrongMethod.status, 405);
});

test("rate-limits public requests before making an upstream call", async () => {
  const calls=[];
  const response=await handlePublicApiRequest(new Request(host+'/api/news?feed=bbc-world',{headers:{'cf-connecting-ip':'203.0.113.10'}}),{
    PUBLIC_API_RATE_LIMITER:{limit:async({key})=>{calls.push(key);return {success:false};}},
  },{fetchImpl:()=>assert.fail('must not fetch when limited')});
  assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
  assert.equal(response.headers.get('access-control-allow-origin'),'*');assert.equal(calls.length,1);
});

test("required production protection fails closed, while preflight remains usable", async () => {
  const response=await handlePublicApiRequest(new Request(host+'/api/map?lat=0&lng=0'),{REQUIRE_PUBLIC_API_LIMITER:'true'},{fetchImpl:()=>assert.fail('must not fetch without protection')});
  assert.equal(response.status,503);
  const preflight=await handlePublicApiRequest(new Request(host+'/api/map',{method:'OPTIONS'}),{REQUIRE_PUBLIC_API_LIMITER:'true'});
  assert.equal(preflight.status,204);
});

test("reports only route and status metrics, never coordinates or authorization", async () => {
  const events=[];
  await handlePublicApiRequest(new Request(host+'/api/geocode?q=private-place',{headers:{'x-sandevistan-ors-key':'private-key','cf-connecting-ip':'203.0.113.10'}}),{
    PUBLIC_API_EVENTS:{writeDataPoint:value=>events.push(value)},PUBLIC_API_ENABLED:'false',
  });
  assert.equal(events.length,1);
  const encoded=JSON.stringify(events);assert.ok(encoded.includes('/api/geocode'));assert.ok(encoded.includes('503'));
  for(const secret of ['private-place','private-key','203.0.113.10'])assert.ok(!encoded.includes(secret));
});

test('serves a permission-complete static privacy policy without an upstream request', async()=>{
 const response=await handlePublicApiRequest(new Request(host+'/privacy'),{PUBLIC_API_ENABLED:'false'},{fetchImpl:()=>assert.fail('policy must be local')});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
 const html=await response.text();
 for(const word of ['Location','Microphone','OpenAI','openrouteservice','Cloudflare','MCP','deletion','sandevistan-api.hmmhmmhm.workers.dev'])assert.ok(html.includes(word),word);
 assert.match(response.headers.get('content-security-policy'),/default-src 'none'/);
});
