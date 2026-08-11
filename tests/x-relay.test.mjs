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

test("relays only X-hosted attached media", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(input);
    return new Response("image-bytes", {
      headers: { "content-type": "image/jpeg" },
    });
  };
  try {
    const media = "https://pbs.twimg.com/media/example.jpg";
    const response = await worker.fetch(new Request(
      `https://relay.example/media?url=${encodeURIComponent(media)}`,
    ));
    assert.equal(response.status, 200);
    assert.equal(calls[0], media);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(
      (await worker.fetch(new Request("https://relay.example/media?url=https://example.com/image.jpg"))).status,
      404,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("relays only PKCE OAuth token exchanges", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push([input, init]);
    return new Response(JSON.stringify({ access_token: "new", refresh_token: "renew", expires_in: 7200 }), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(new Request("https://relay.example/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&client_id=public-client&refresh_token=renew",
    }));
    assert.equal(response.status, 200);
    assert.equal(calls[0][0], "https://api.x.com/2/oauth2/token");
    assert.match(
      (await worker.fetch(new Request("https://relay.example/oauth2/token", { method: "OPTIONS" })))
        .headers.get("access-control-allow-methods"),
      /POST/,
    );
    assert.equal((await worker.fetch(new Request("https://relay.example/oauth2/token"))).status, 405);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
