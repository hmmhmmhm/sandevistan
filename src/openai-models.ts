import { createTimeout } from "../server/http.js";
import { DEFAULT_OPENAI_MODELS, selectOpenAiModels } from "../server/openai-auth.js";
import { logDiagnostic } from "./diagnostic-log";
export { DEFAULT_OPENAI_MODELS } from "../server/openai-auth.js";
export type OpenAiModels = typeof DEFAULT_OPENAI_MODELS;

export async function resolveOpenAiModels(
  key: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<OpenAiModels> {
  const timeout = createTimeout(6_000, undefined, undefined, signal);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` }, signal: timeout.signal,
    });
    const value: unknown = await response.json();
    if (!response.ok || typeof value !== "object" || value === null
      || !("data" in value) || !Array.isArray(value.data)) return DEFAULT_OPENAI_MODELS;
    const ids = value.data.flatMap((entry: unknown) => (
      typeof entry === "object" && entry !== null && "id" in entry
        && typeof entry.id === "string" ? [entry.id] : []
    ));
    const models = selectOpenAiModels(ids);
    logDiagnostic("LIVE", `OpenAI models · ${models.realtime} / ${models.analysis} / ${models.search}`);
    return models;
  } catch {
    signal.throwIfAborted();
    logDiagnostic("ERROR", "OpenAI model catalog unavailable; using reviewed aliases");
    return DEFAULT_OPENAI_MODELS;
  } finally {
    timeout.dispose();
  }
}
