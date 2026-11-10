import { expect, it, vi } from "vitest";
import { requestConversateAnalysis } from "./conversate-analysis";
import { DEFAULT_CONVERSATE_SETTINGS } from "./conversate-state";

it("runs BYOK Conversate analysis without requiring a same-origin API server", async () => {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(input).toBe("https://api.openai.com/v1/responses");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk-test-1234567890abcdefghijklmnop" });
    return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ language: "en", translation: "안녕하세요", inform: null, suggestions: [] }) }] }] });
  });
  await expect(requestConversateAnalysis({
    key: "sk-test-1234567890abcdefghijklmnop", locale: "ko", settings: DEFAULT_CONVERSATE_SETTINGS,
    segments: [{ id: "test", text: "Hello", at: new Date().toISOString() }],
    signal: new AbortController().signal, fetchImpl,
  })).resolves.toMatchObject({ translation: "안녕하세요" });
});


it("retains an older agreement for cues while bounding translation-only context", async () => {
  for (const cues of [true, false]) {
    let input: { previousContext: string[]; currentUtterance: string } | undefined;
    await requestConversateAnalysis({
      key: "sk-test-1234567890abcdefghijklmnop", locale: "ko",
      settings: { ...DEFAULT_CONVERSATE_SETTINGS, inform: cues, copilot: cues },
      segments: Array.from({ length: 30 }, (_, i) => ({ id: String(i), text: `Agreement ${i}`, at: "2026-11-08T00:00:00Z" })),
      signal: new AbortController().signal,
      fetchImpl: async (_url, init) => {
        input = JSON.parse(JSON.parse(String(init?.body)).input[0].content);
        return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify({ language: "en", translation: null, inform: null, suggestions: [] }) }] }] });
      },
    });
    expect(input?.previousContext).toHaveLength(cues ? 23 : 7);
    expect(input?.previousContext[0]).toBe(cues ? "Agreement 6" : "Agreement 22");
    expect(input?.currentUtterance).toBe("Agreement 29");
  }
});
