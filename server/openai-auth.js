import { jsonResponse } from "./http.js";

export const OPENAI_KEY_HEADER = "x-sandevistan-openai-key";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function validOpenAiKey(value) {
  return typeof value === "string"
    && value.startsWith("sk-")
    && value.length >= 20
    && value.length <= 4_096
    && !CONTROL_CHARACTERS.test(value);
}

export function openAiError(code, message, status) {
  return jsonResponse(
    { error: { code, message } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export const DEFAULT_OPENAI_MODELS = Object.freeze({
  analysis: "gpt-6-luna",
  search: "gpt-6.1-sol",
  realtime: "gpt-realtime-2.1",
  transcription: "gpt-live-transcribe",
  refinement: "gpt-transcribe",
});

const MODEL_FAMILIES = {
  analysis: /^gpt-(\d+(?:\.\d+)?)-luna$/,
  search: /^gpt-(\d+(?:\.\d+)?)-sol$/,
  realtime: /^gpt-realtime-(\d+(?:\.\d+)?)$/,
};

export function allowedOpenAiModel(role, model) {
  return typeof model === "string" && Boolean(MODEL_FAMILIES[role]?.test(model));
}

export function selectOpenAiModels(ids) {
  const models = { ...DEFAULT_OPENAI_MODELS };
  for (const [role, pattern] of Object.entries(MODEL_FAMILIES)) {
    const candidates = ids.filter((id) => typeof id === "string" && pattern.test(id));
    candidates.sort((left, right) => {
      const a = left.match(pattern)[1].split(".").map(Number);
      const b = right.match(pattern)[1].split(".").map(Number);
      return (b[0] - a[0]) || ((b[1] ?? 0) - (a[1] ?? 0));
    });
    if (candidates[0]) models[role] = candidates[0];
  }
  return models;
}
