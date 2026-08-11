import assert from "node:assert/strict";
import test from "node:test";
import worker from "../x-relay/index.js";

function request(path, options = {}) {
  return new Request(`https://relay.example${path}`, {
    headers: { authorization: "Bearer local-user-token" },
    ...options,
  });
}

test("relays only the two X read routes with the user's authorization", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push([input, init]);
    return new Response(JSON.stringify({ data: { id: "me" } }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(request("/2/users/me"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(calls[0][0], "https://api.x.com/2/users/me");
    assert.deepEqual(calls[0][1].headers, {
      authorization: "Bearer local-user-token",
      accept: "application/json",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects non-X routes and writes", async () => {
  assert.equal((await worker.fetch(request("/2/tweets"))).status, 404);
  assert.equal((await worker.fetch(request("/2/users/me", { method: "POST" }))).status, 405);
});

test("relays only registered RSS feeds without X credentials", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push([input, init]);
    return new Response("<rss><channel /></rss>", {
      headers: { "content-type": "application/rss+xml" },
    });
  };
  try {
    const response = await worker.fetch(new Request("https://relay.example/news?feed=sbs-latest"));
    assert.equal(response.status, 200);
    assert.match(calls[0][0], /^https:\/\/news\.sbs\.co\.kr\//);
    assert.equal(calls[0][1].headers.authorization, undefined);
    assert.equal((await worker.fetch(new Request("https://relay.example/news?url=https://example.com"))).status, 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
