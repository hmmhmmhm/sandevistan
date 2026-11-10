import assert from "node:assert/strict";
import test from "node:test";
import { handleAiWebSearchRequest } from "../server/ai-web-search.js";

const KEY = "sk-test-1234567890abcdefghijklmnop";

function request(body = { query: "latest G2 firmware", locale: "en" }, key = KEY) {
  return new Request("https://example.test/api/ai-web-search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-sandevistan-openai-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("web search requires BYOK and a bounded query", async () => {
  const missing = await handleAiWebSearchRequest(request({}, null), {}, {
    fetchImpl: () => assert.fail("must not call upstream"),
  });
  assert.equal(missing.status, 401);

  const invalid = await handleAiWebSearchRequest(request({ query: "" }), {}, {
    fetchImpl: () => assert.fail("must not call upstream"),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "SEARCH_QUERY_INVALID");
});

test("returns bounded grounded text, HTTPS citations, and usage", async () => {
  let upstreamRequest;
  const response = await handleAiWebSearchRequest(request(), {}, {
    fetchImpl: async (url, init) => {
      upstreamRequest = { url, init };
      return Response.json({
        model: "gpt-5.5-2026-07-01",
        output: [
          { type: "web_search_call", status: "completed", action: { type: "search" } },
          { type: "web_search_call", status: "completed", action: { type: "open_page" } },
          {
            type: "message",
            content: [{
              type: "output_text",
              text: "Firmware 2.2 is current.",
              annotations: [
                { type: "url_citation", title: "Even support", url: "https://example.com/support" },
                { type: "url_citation", title: "Unsafe", url: "javascript:alert(1)" },
              ],
            }],
          },
        ],
        usage: {
          input_tokens: 22,
          input_tokens_details: { cached_tokens: 4 },
          output_tokens: 9,
        },
      });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    answer: "Firmware 2.2 is current.",
    sources: [{ title: "Even support", url: "https://example.com/support" }],
    usage: {
      model: "gpt-5.5-2026-07-01",
      inputTokens: 22,
      cachedInputTokens: 4,
      outputTokens: 9,
      webSearchCalls: 1,
    },
  });
  assert.equal(upstreamRequest.url, "https://api.openai.com/v1/responses");
  assert.equal(upstreamRequest.init.headers.Authorization, `Bearer ${KEY}`);
  const body = JSON.parse(upstreamRequest.init.body);
  assert.equal(body.model, "gpt-6.1-sol");
  assert.deepEqual(body.reasoning, { effort: "low" });
  assert.deepEqual(body.tools, [{
    type: "web_search",
    search_context_size: "medium",
  }]);
  assert.equal(body.tool_choice, "required");
  assert.equal(body.input, "latest G2 firmware");
});

test("logs only bounded upstream error metadata and never retries", async () => {
  let calls = 0;
  const warnings = [];
  const response = await handleAiWebSearchRequest(request(), {}, {
    fetchImpl: async () => {
      calls += 1;
      return Response.json({
        error: {
          type: "rate_limit_error",
          code: "rate_limit_exceeded",
          message: KEY,
        },
      }, { status: 429 });
    },
    logWarn: (message) => warnings.push(message),
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(KEY), false);
  assert.deepEqual(warnings, [
    "[AI SEARCH] upstream rejected · status 429 · type rate_limit_error · code rate_limit_exceeded",
  ]);
  assert.equal(warnings.join(" ").includes(KEY), false);
});
