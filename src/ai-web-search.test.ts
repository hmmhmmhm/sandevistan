import { describe, expect, it, vi } from "vitest";
import { requestAiWebSearch } from "./ai-web-search";

const KEY = "sk-test-1234567890abcdefghijklmnop";

describe("Ask AI web-search client", () => {
  it("accepts bounded model-aware cached usage", async () => {
    const fetchImpl = vi.fn(async () => Response.json({
      model: "gpt-6.1-sol",
      output: [
        { type: "web_search_call", action: { type: "search" } },
        { content: [{ type: "output_text", text: "Grounded answer", annotations: [] }] },
      ],
      usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 20 }, output_tokens: 30 },
    }));
    await expect(requestAiWebSearch({
      key: KEY,
      query: "current facts",
      locale: "en",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).resolves.toMatchObject({
      usage: { model: "gpt-6.1-sol", cachedInputTokens: 20 },
    });
  });

  it.each([
    { model: "", inputTokens: 10, cachedInputTokens: 0 },
    { model: "x".repeat(121), inputTokens: 10, cachedInputTokens: 0 },
  ])("rejects invalid usage envelope %#", async (invalid) => {
    const fetchImpl = vi.fn(async () => Response.json({
      model: invalid.model,
      output: [{ content: [{ type: "output_text", text: "Grounded answer", annotations: [] }] }],
      usage: { input_tokens: invalid.inputTokens, input_tokens_details: { cached_tokens: invalid.cachedInputTokens }, output_tokens: 1 },
    }));
    await expect(requestAiWebSearch({
      key: KEY,
      query: "current facts",
      locale: "en",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow("Web search failed");
  });
});
