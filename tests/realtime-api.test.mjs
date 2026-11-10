import assert from "node:assert/strict";
import test from "node:test";
import { sandevistanDevApi } from "../server/dev-api.js";
import { handleRealtimeTokenRequest } from "../server/realtime.js";

const HEADER = "x-sandevistan-openai-key";
const KEY = "sk-test-1234567890abcdefghijklmnop";

function request(key = KEY) {
  return new Request("https://example.test/api/realtime-token", {
    method: "POST",
    headers: key === null ? {} : { [HEADER]: key },
  });
}

test("mounts the local API middleware in Vite preview as well as dev", () => {
  const plugin = sandevistanDevApi();
  const middlewareFor = (hook) => {
    let registered;
    plugin[hook]?.({
      middlewares: {
        use(middleware) {
          registered = middleware;
        },
      },
    });
    return registered;
  };

  assert.equal(typeof middlewareFor("configureServer"), "function");
  assert.equal(typeof middlewareFor("configurePreviewServer"), "function");
});

test("realtime token endpoint requires a plausible BYOK key", async () => {
  const missing = await handleRealtimeTokenRequest(request(null), {}, {
    fetchImpl: () => assert.fail("must not call upstream"),
  });
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), {
    error: { code: "OPENAI_KEY_REQUIRED", message: "OpenAI key required" },
  });

  const invalid = await handleRealtimeTokenRequest(request("not-a-key"), {}, {
    fetchImpl: () => assert.fail("must not call upstream"),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "OPENAI_KEY_INVALID");
});

test("mints and returns only a bounded ephemeral secret", async () => {
  let upstreamRequest;
  const response = await handleRealtimeTokenRequest(request(), {}, {
    fetchImpl: async (url, init) => {
      upstreamRequest = { url, init };
      return Response.json({
        value: "ek_test_safe_ephemeral",
        expires_at: 1_786_000_000,
        client_secret: "ignored",
      });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    value: "ek_test_safe_ephemeral",
    expiresAt: 1_786_000_000,
    model: "gpt-realtime-2.1",
  });
  assert.equal(upstreamRequest.url,
    "https://api.openai.com/v1/realtime/client_secrets");
  assert.equal(upstreamRequest.init.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(JSON.parse(upstreamRequest.init.body), {
    session: { type: "realtime", model: "gpt-realtime-2.1" },
  });
});

test("hides upstream errors and never reflects the submitted key", async () => {
  const response = await handleRealtimeTokenRequest(request(), {}, {
    fetchImpl: async () => new Response(
      JSON.stringify({ error: { message: `invalid ${KEY}` } }),
      { status: 401, headers: { "content-type": "application/json" } },
    ),
  });
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.equal(text.includes(KEY), false);
  assert.deepEqual(JSON.parse(text), {
    error: {
      code: "OPENAI_TOKEN_REJECTED",
      message: "OpenAI rejected the Realtime session",
    },
  });
});

test("returns a generic timeout without retrying", async () => {
  let calls = 0;
  const response = await handleRealtimeTokenRequest(request(), {}, {
    fetchImpl: async () => {
      calls += 1;
      throw new DOMException("Timed out", "AbortError");
    },
  });
  assert.equal(response.status, 504);
  assert.equal(calls, 1);
  assert.equal((await response.json()).error.code, "OPENAI_TOKEN_TIMEOUT");
});

test("rejects oversized token request bodies before contacting OpenAI", async () => {
  const response = await handleRealtimeTokenRequest(new Request(request(), {
    body: JSON.stringify({ purpose: "transcription", padding: "x".repeat(5_000) }),
  }), {}, { fetchImpl: () => assert.fail("must reject before upstream") });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "OPENAI_TOKEN_REQUEST_INVALID");
});
