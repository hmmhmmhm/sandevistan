import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { handleAiWebSearchRequest, handleConversateRequest } from "../server/ai-web-search.js";
import { handleRealtimeTokenRequest } from "../server/realtime.js";

for (const [name, handler, body, milliseconds, code] of [
  ["search", handleAiWebSearchRequest, { query: "news" }, 30_000, "WEB_SEARCH_TIMEOUT"],
  ["conversate", handleConversateRequest, { transcript: ["hello"] }, 20_000, "CONVERSATE_TIMEOUT"],
  ["token", handleRealtimeTokenRequest, {}, 8_000, "OPENAI_TOKEN_TIMEOUT"],
]) {
  test(`${name} deadline includes a stalled upstream response body`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let controller;
    let result;
    const pending = handler(new Request("https://example.test/api/test", {
      method: "POST",
      headers: { "x-sandevistan-openai-key": "sk-test-1234567890abcdefghijklmnop" },
      body: JSON.stringify(body),
    }), {}, {
      fetchImpl: async (_url, { signal }) => new Response(new ReadableStream({
        start(value) {
          controller = value;
          signal.addEventListener("abort", () => {
            value.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      })),
    }).then((response) => { result = response; return response; });
    try {
      await setImmediate();
      t.mock.timers.tick(milliseconds);
      await setImmediate();
      assert.ok(result, "must finish when the deadline expires after headers");
      assert.equal(result.status, 504);
      assert.equal((await result.json()).error.code, code);
    } finally {
      controller?.error(new DOMException("Test cleanup", "AbortError"));
      await pending;
    }
  });
}
