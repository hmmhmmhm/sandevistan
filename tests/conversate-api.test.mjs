import assert from "node:assert/strict";
import test from "node:test";
import { handleConversateRequest } from "../server/ai-web-search.js";

const KEY = "sk-test-1234567890abcdefghijklmnop";
const request = (body, key = KEY) => new Request("https://example.test/api/conversate-analyze", {
  method: "POST",
  headers: { "content-type": "application/json", ...(key ? { "x-sandevistan-openai-key": key } : {}) },
  body: JSON.stringify(body),
});

test("returns bounded translation, Inform, and three Copilot choices", async () => {
  let upstream;
  const response = await handleConversateRequest(request({
    locale: "ko",
    transcript: ["Could we move the meeting to Friday?"],
    settings: { translation: true, inform: true, prepNote: true, prepNoteText: "Project Atlas", copilot: true, goal: "Reschedule" },
  }), {}, {
    fetchImpl: async (url, init) => {
      upstream = { url, init };
      return Response.json({ output: [{ type: "message", content: [{
        type: "output_text",
        text: JSON.stringify({
          language: "en", translation: "회의를 금요일로 옮길 수 있을까요?",
          inform: "Friday is the requested new meeting day.",
          suggestions: ["direct", "warm", "explore"].map((style) => ({
            original: `${style} reply`, pronunciation: `${style} 발음`, meaning: `${style} 뜻`, style,
          })),
        }),
      }] }] });
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).suggestions.length, 3);
  const body = JSON.parse(upstream.init.body);
  assert.equal(upstream.url, "https://api.openai.com/v1/responses");
  assert.equal(body.model, "gpt-6-luna");
  assert.deepEqual(body.reasoning, { effort: "none" });
  assert.equal(body.tools, undefined);
  assert.equal(body.tool_choice, undefined);
  assert.match(body.instructions, /mixed-language speech, translation MUST translate every foreign-language span/);
  assert.match(body.instructions, /Return null only for greetings, filler/);
  assert.equal(upstream.init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(upstream.init.body.includes(KEY), false);
});

test("rejects missing BYOK and empty transcripts before upstream", async () => {
  const dependencies = { fetchImpl: () => assert.fail("must not call upstream") };
  assert.equal((await handleConversateRequest(request({ transcript: [] }, null), {}, dependencies)).status, 401);
  assert.equal((await handleConversateRequest(request({ transcript: [] }), {}, dependencies)).status, 400);
});

test("reports bounded upstream rejection metadata without exposing the key", async () => {
  const warnings = [];
  const response = await handleConversateRequest(request({
    locale: "ko",
    transcript: ["Project Atlas uses a vector database."],
    settings: { inform: true, copilot: true },
  }), {}, {
    fetchImpl: async () => Response.json({
      error: { type: "invalid_request_error", code: "model_not_found", message: KEY },
    }, { status: 400 }),
    logWarn: (message) => warnings.push(message),
  });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("x-sandevistan-upstream-status"), "400");
  assert.equal(response.headers.get("x-sandevistan-upstream-code"), "model_not_found");
  assert.deepEqual(warnings, [
    "[CONVERSATE] upstream rejected · status 400 · type invalid_request_error · code model_not_found",
  ]);
  assert.equal(warnings[0].includes(KEY), false);
});

test("streams translation and Inform before the remaining suggestions finish", async () => {
  let controller;
  const partials = [];
  const stream = new ReadableStream({ start(value) { controller = value; } });
  const pending = handleConversateRequest(request({ transcript: ["Hello"], locale: "ko" }), {}, {
    onPartial: (value) => partials.push(value),
    fetchImpl: async () => new Response(stream, { headers: { "content-type": "text/event-stream" } }),
  });
  const emit = (event) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
  emit({ type: "response.output_text.delta", delta: '{ "language": "en", "translation": "안녕하세요", "inform": "인사 표현입니다", "suggestions": [' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(partials.at(-1), { language: "en", translation: "안녕하세요", inform: "인사 표현입니다" });
  emit({ type: "response.completed", response: { output: [{ content: [{ type: "output_text", text: JSON.stringify({ language: "en", translation: "안녕하세요", inform: "인사 표현입니다", suggestions: [] }) }] }] } });
  controller.close();
  assert.equal((await pending).status, 200);
});

test("separates the exact current utterance from earlier conversation context", async () => {
  let sent;
  await handleConversateRequest(request({ locale: 'ko', transcript: ['Send the budget.', 'Our retention is 110%.'], settings: { translation: true, inform: false, copilot: false } }), {}, {
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ language: 'en', translation: '유지율은 110%입니다.', inform: null, suggestions: [] }) }] }] });
    },
  });
  assert.equal(sent.input.length, 1);
  const source = JSON.parse(sent.input[0].content);
  assert.equal(source.currentUtterance, 'Our retention is 110%.');
  assert.deepEqual(source.previousContext, ['Send the budget.']);
});
