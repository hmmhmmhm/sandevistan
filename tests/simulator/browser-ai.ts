import { CreateStartUpPageContainer, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createNativeAiTextPage } from "../../src/native-ai-text";
import { resolveOpenAiModels } from "../../src/openai-models";
import { requestRealtimeClientSecret } from "../../src/ai-realtime-token";
import { requestConversateAnalysis } from "../../src/conversate-analysis";
import { requestAiWebSearch } from "../../src/ai-web-search";
import { DEFAULT_CONVERSATE_SETTINGS } from "../../src/conversate-state";
const origin = "http://127.0.0.1:9899";
const bridge = await waitForEvenAppBridge();
const page = createNativeAiTextPage("BROWSER AI CHECK RUNNING");
await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: page.textObject }));
let key: string | undefined;
const results: Record<string, unknown> = {};
try {
  const handoff = await fetch(origin + "/key", { headers: { "x-sandevistan-verifier": "memory-only" }, cache: "no-store" });
  if (!handoff.ok) throw new Error("Credential handoff failed");
  const credential = await handoff.json();
  key = credential.key;
  if (typeof key !== "string") throw new Error("Credential unavailable");
  const abort = new AbortController();
  const models = await resolveOpenAiModels(key, fetch, abort.signal);
  results.models = models;
  const secret = await requestRealtimeClientSecret({ key, fetchImpl: fetch, signal: abort.signal, model: models.realtime });
  results.clientSecret = Boolean(secret);
  const partials: string[] = [];
  const analysis = await requestConversateAnalysis({
    key, locale: "ko", model: models.analysis, settings: DEFAULT_CONVERSATE_SETTINGS,
    segments: [{ id: "browser-fixture", text: "Can we review the vector database design next Friday?", at: new Date().toISOString() }],
    signal: abort.signal,
    onPartial: (value) => { if (value.translation) partials.push(value.translation); },
  });
  results.analysis = analysis;
  results.streamedTranslation = partials.length > 0;
  const search = await requestAiWebSearch({ key, locale: "ko", query: "Find the official Even Realities G2 display resolution.", model: models.search, signal: abort.signal });
  results.search = { answer: search.answer, sources: search.sources, model: search.usage.model };
  results.ok = true;
} catch (error) {
  results.ok = false;
  results.error = error instanceof Error ? error.name : "UnknownError";
} finally {
  key = undefined;
}
document.querySelector("#status")!.textContent = JSON.stringify(results, null, 2);
await fetch(origin + "/result", { method: "POST", headers: { "Content-Type": "application/json", "x-sandevistan-verifier": "memory-only" }, body: JSON.stringify(results) });
await bridge.rebuildPageContainer(createNativeAiTextPage(results.ok ? "BROWSER AI CHECK PASSED\nModels, secret, streamed analysis, and web search." : "BROWSER AI CHECK FAILED\nSee redacted verifier results."));
console.info(`SIM_BROWSER_AI_DONE ok=${results.ok}`);
