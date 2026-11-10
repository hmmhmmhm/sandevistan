import { EMPTY_AI_USAGE, type AiUsage } from "./ai-cost";

export type RealtimeServerEvent = {
  readonly type?: string;
  readonly item_id?: string;
  readonly response_id?: string;
  readonly transcript?: string;
  readonly delta?: string;
  readonly text?: string;
  readonly error?: { readonly message?: string };
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly input_token_details?: {
      readonly text_tokens?: number;
      readonly audio_tokens?: number;
    };
    readonly output_token_details?: { readonly text_tokens?: number };
  };
  readonly response?: {
    readonly id?: string;
    readonly status?: string;
    readonly status_details?: { readonly error?: { readonly message?: string } };
    readonly usage?: {
      readonly input_tokens?: number;
      readonly output_tokens?: number;
      readonly input_token_details?: {
        readonly text_tokens?: number;
        readonly audio_tokens?: number;
        readonly cached_tokens?: number;
        readonly cached_text_tokens?: number;
        readonly cached_audio_tokens?: number;
        readonly cached_tokens_details?: {
          readonly text_tokens?: number;
          readonly audio_tokens?: number;
        };
      };
      readonly output_token_details?: { readonly text_tokens?: number };
    };
  };
};

function token(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function usageFromResponse(event: RealtimeServerEvent): AiUsage {
  const usage = event.response?.usage;
  const input = usage?.input_token_details;
  const output = usage?.output_token_details;
  const totalText = token(input?.text_tokens ?? usage?.input_tokens);
  const totalAudio = token(input?.audio_tokens);
  const cachedTotal = token(input?.cached_tokens);
  let cachedText = token(
    input?.cached_tokens_details?.text_tokens ?? input?.cached_text_tokens,
  );
  let cachedAudio = token(
    input?.cached_tokens_details?.audio_tokens ?? input?.cached_audio_tokens,
  );
  let unclassifiedCached = Math.max(
    0,
    cachedTotal - cachedText - cachedAudio,
  );
  const extraText = Math.min(
    unclassifiedCached,
    Math.max(0, totalText - cachedText),
  );
  cachedText += extraText;
  unclassifiedCached -= extraText;
  cachedAudio += Math.min(
    unclassifiedCached,
    Math.max(0, totalAudio - cachedAudio),
  );
  return {
    ...EMPTY_AI_USAGE,
    textInputTokens: Math.max(0, totalText - cachedText),
    cachedTextInputTokens: cachedText,
    audioInputTokens: Math.max(0, totalAudio - cachedAudio),
    cachedAudioInputTokens: cachedAudio,
    textOutputTokens: token(output?.text_tokens ?? usage?.output_tokens),
  };
}

export function usageFromTranscription(event: RealtimeServerEvent): AiUsage {
  const usage = event.usage;
  return {
    ...EMPTY_AI_USAGE,
    transcriptionAudioInputTokens: token(
      usage?.input_token_details?.audio_tokens ?? usage?.input_tokens,
    ),
    transcriptionTextOutputTokens: token(
      usage?.output_token_details?.text_tokens ?? usage?.output_tokens,
    ),
  };
}
