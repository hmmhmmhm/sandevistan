import assert from "node:assert/strict";
import test from "node:test";
import { sandevistanDevApi } from "../server/dev-api.js";

function middleware() {
  let handler;
  sandevistanDevApi().configureServer({
    middlewares: { use(value) { handler = value; } },
  });
  return handler;
}

function output() {
  return {
    statusCode: 0,
    setHeader() {},
    end(body) { this.body = JSON.parse(body.toString()); },
  };
}

test("passes non-API requests through without reading their bodies", async () => {
  let nextCalls = 0;
  await middleware()({
    url: "/assets/test.js", method: "POST", headers: {},
    async *[Symbol.asyncIterator]() { assert.fail("must not read asset body"); },
  }, output(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
});

test("rejects an oversized dev API body before consuming more chunks", async () => {
  const response = output();
  await middleware()({
    url: "/api/conversate-analyze", method: "POST", headers: {},
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(32_001);
      assert.fail("must stop consuming oversized body");
    },
  }, response, () => assert.fail("must not pass API to Vite"));
  assert.equal(response.statusCode, 413);
  assert.equal(response.body.error.code, "REQUEST_TOO_LARGE");
});

test("returns HTTP 413 for an oversized body over a real connection", async () => {
  const { createServer } = await import("node:http");
  const handler = middleware();
  const server = createServer((request, response) => {
    void handler(request, response, () => response.end());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/test`, {
      method: "POST", body: "x".repeat(100_000),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "REQUEST_TOO_LARGE");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("keeps empty token POSTs valid through the actual local middleware", async (t) => {
  const { createServer } = await import("node:http");
  const nativeFetch = fetch;
  t.mock.method(globalThis, "fetch", async () => Response.json({ value: "ek_test_safe_ephemeral", expires_at: 1_786_000_000 }));
  const handler = middleware();
  const server = createServer((request, response) => { void handler(request, response, () => response.end()); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await nativeFetch(`http://127.0.0.1:${port}/api/realtime-token`, {
      method: "POST", headers: { "x-sandevistan-openai-key": "sk-test-1234567890abcdefghijklmnop" },
    });
    assert.equal(response.status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
