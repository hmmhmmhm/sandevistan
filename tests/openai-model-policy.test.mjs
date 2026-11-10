import assert from "node:assert/strict";
import test from "node:test";
import { selectOpenAiModels, DEFAULT_OPENAI_MODELS, allowedOpenAiModel } from "../server/openai-auth.js";
test("selects the newest compatible family for each role, not release timestamps", () => {
  assert.deepEqual(selectOpenAiModels([
    "gpt-6-luna", "gpt-6.2-luna", "gpt-7-luna", "gpt-6.1-sol", "gpt-6.10-sol",
    "gpt-realtime-2.1", "gpt-realtime-3", "gpt-realtime-3-mini", "gpt-live-1",
    "gpt-realtime-2025-08-28", "gpt-99-sol-2099-01-01",
  ]), { ...DEFAULT_OPENAI_MODELS, analysis: "gpt-7-luna", search: "gpt-6.10-sol", realtime: "gpt-realtime-3" });
});
test("keeps reviewed aliases on unavailable catalogs and restricts role models", () => {
  assert.deepEqual(selectOpenAiModels([]), DEFAULT_OPENAI_MODELS);
  assert.equal(allowedOpenAiModel("analysis", "gpt-6-luna"), true);
  assert.equal(allowedOpenAiModel("analysis", "gpt-6-astra"), false);
});
