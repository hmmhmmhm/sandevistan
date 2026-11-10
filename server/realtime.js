import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
  readLimitedRequestJson,
} from "./http.js";
import {
  DEFAULT_OPENAI_MODELS,
  OPENAI_KEY_HEADER,
  openAiError,
  validOpenAiKey,
} from "./openai-auth.js";

export { OPENAI_KEY_HEADER } from "./openai-auth.js";
export const OPENAI_REALTIME_MODEL = DEFAULT_OPENAI_MODELS.realtime;
export const OPENAI_TRANSCRIPTION_MODEL = "gpt-live-transcribe";
const OPENAI_TOKEN_URL = "https://api.openai.com/v1/realtime/client_secrets";
const TOKEN_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 16_384;

export async function handleRealtimeTokenRequest(
  request,
  _env,
  dependencies = {},
) {
  const key = request.headers.get(OPENAI_KEY_HEADER)?.trim();
  if (!key) {
    return openAiError(
      "OPENAI_KEY_REQUIRED",
      "OpenAI key required",
      401,
    );
  }
  if (!validOpenAiKey(key)) {
    return openAiError(
      "OPENAI_KEY_INVALID",
      "OpenAI key is invalid",
      400,
    );
  }
  let purpose = "assistant";
  try {
    const body = await readLimitedRequestJson(request, 4_096, { allowEmpty: true });
    if (body?.purpose === "transcription") purpose = "transcription";
  } catch {
    return openAiError("OPENAI_TOKEN_REQUEST_INVALID", "Realtime request is invalid", 400);
  }
  const session = purpose === "transcription"
    ? { type: "transcription", audio: { input: { transcription: {
        model: OPENAI_TRANSCRIPTION_MODEL,
      } } } }
    : { type: "realtime", model: OPENAI_REALTIME_MODEL };

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const timeout = createTimeout(TOKEN_TIMEOUT_MS);
  try {
    const upstream = await fetchImpl(OPENAI_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session,
      }),
      signal: timeout.signal,
    });


    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      return openAiError(
        "OPENAI_TOKEN_REJECTED",
        "OpenAI rejected the Realtime session",
        502,
      );
    }

    let data;
    try {
      const bytes = await readLimitedBytes(upstream, MAX_UPSTREAM_BYTES);
      data = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      timeout.signal.throwIfAborted();
      return openAiError(
        "OPENAI_TOKEN_INVALID",
        "OpenAI returned an invalid Realtime session",
        502,
      );
    }
    if (
      typeof data?.value !== "string"
      || data.value.length < 10
      || data.value.length > 4_096
      || !Number.isFinite(data.expires_at)
    ) {
      return openAiError(
        "OPENAI_TOKEN_INVALID",
        "OpenAI returned an invalid Realtime session",
        502,
      );
    }
    return jsonResponse(
      {
        value: data.value,
        expiresAt: data.expires_at,
        model: purpose === "transcription"
          ? OPENAI_TRANSCRIPTION_MODEL
          : OPENAI_REALTIME_MODEL,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return openAiError(
      error?.name === "AbortError"
        ? "OPENAI_TOKEN_TIMEOUT"
        : "OPENAI_TOKEN_UNAVAILABLE",
      error?.name === "AbortError"
        ? "OpenAI Realtime session timed out"
        : "OpenAI Realtime session is unavailable",
      error?.name === "AbortError" ? 504 : 502,
    );
  } finally {
    timeout.dispose();
  }
}
