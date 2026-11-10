import assert from "node:assert/strict";
import test from "node:test";
import { readLimitedRequestJson } from "../server/http.js";

test("stops reading and cancels an oversized chunked JSON request", async () => {
  let cancelled = false;
  const request = new Request("https://example.test/api/conversate-analyze", {
    method: "POST",
    duplex: "half",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"text":"too long'));
      },
      pull() {
        throw new Error("read beyond the byte limit");
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }),
  });
  await assert.rejects(readLimitedRequestJson(request, 8), /REQUEST_TOO_LARGE/);
  assert.equal(cancelled, true);
});

test("reads JSON within the byte limit and rejects malformed JSON", async () => {
  const request = (body) => new Request("https://example.test/api/test", {
    method: "POST", body,
  });
  assert.deepEqual(await readLimitedRequestJson(request('{"ok":true}'), 11), { ok: true });
  await assert.rejects(readLimitedRequestJson(request('{'), 11), SyntaxError);
});
