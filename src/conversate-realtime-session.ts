import { createRealtimeConfigurationGate } from "./realtime-configuration-gate";
import { resolveOpenAiModels, type OpenAiModels } from "./openai-models";
import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createAudioAppendEvent, resamplePcm16Le16To24 } from "./ai-realtime-audio";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import {
  createDefaultRealtimeSocket,
  type RealtimeSocket,
} from "./ai-realtime-transport";
import { logDiagnostic } from "./diagnostic-log";
import type { PhoneLocale } from "./phone-types";
import { createConversateTurnMatcher } from "./conversate-turn-matching";
import { createConversateLocalVad } from "./conversate-local-vad";

const REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;

type Bridge = {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type ConversateRealtimeSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createConversateRealtimeSession(options: {
  readonly bridge: Bridge;
  readonly key: string;
  readonly locale: PhoneLocale;
  readonly prompt?: string;
  readonly onModels?: (models: OpenAiModels) => void;
  readonly languages?: readonly string[];
  readonly keywords?: readonly string[];
  readonly onPartial: (itemId: string, text: string) => void;
  readonly onCompleted: (itemId: string, text: string) => void;
  readonly onRefined: (itemId: string, text: string) => void;
  readonly onError: (message: string) => void;
  readonly fetchImpl?: typeof fetch;
  readonly createSocket?: (url: string, protocols: string[]) => RealtimeSocket;
}): ConversateRealtimeSession {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const socketFactory = options.createSocket ?? createDefaultRealtimeSocket;
  let socket: RealtimeSocket | undefined;
  let refinementSocket: RealtimeSocket | undefined;
  let unsubscribe: (() => void) | undefined;
  let microphoneOpen = false;
  let microphoneActivation: Promise<boolean> | undefined;
  let cleanup: Promise<void> | undefined;
  let starting = false;
  let closing = false;
  const partials = new Map<string, string>();
  const turnMatcher = createConversateTurnMatcher(options.onRefined);
  let configured = false;
  let usedCompatibilityFallback = false;
  const abort = new AbortController();
  const localVad = createConversateLocalVad();
  const configuration = createRealtimeConfigurationGate<RealtimeSocket>();
  const languages = [...new Set(options.languages ?? [])]
    .filter((value) => /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(value))
    .slice(0, 3);
  const keywords = [...new Set(options.keywords ?? [])]
    .map((value) => value.trim())
    .filter((value) => value && value.length <= 100 && !/[<>\r\n]/.test(value))
    .slice(0, 50);

  const send = (target: RealtimeSocket | undefined, value: unknown) => {
    if (target?.readyState === SOCKET_OPEN) target.send(JSON.stringify(value));
  };

  const sendLiveConfiguration = (extended: boolean) => {
    configured = false;
    send(socket, {
      type: "session.update",
      session: {
        type: "transcription",
        audio: { input: {
          format: { type: "audio/pcm", rate: 24_000 },
          transcription: {
            model: "gpt-live-transcribe",
            delay: extended ? "medium" : "low",
            ...(extended && options.prompt ? { prompt: options.prompt } : {}),
            ...(extended && languages.length ? { languages } : {}),
            ...(extended && keywords.length ? { keywords } : {}),
          },
          turn_detection: null,
        } },
      },
    });
  };

  const closeMicrophone = async () => {
    if (!microphoneOpen) return;
    await options.bridge.audioControl(false).catch(() => false);
    microphoneOpen = false;
  };

  const stop = () => {
    closing = true;
    abort.abort();
    cleanup ??= (async () => {
      unsubscribe?.();
      unsubscribe = undefined;
      socket?.close();
      socket = undefined;
      refinementSocket?.close();
      refinementSocket = undefined;
      if (microphoneActivation) {
        microphoneOpen = await microphoneActivation.catch(() => false);
        microphoneActivation = undefined;
      }
      await closeMicrophone();
    })();
    return cleanup;
  };

  const openSocket = (secret: string, refinement = false) => new Promise<void>((resolve, reject) => {
    if (closing) { reject(new DOMException("Stopped", "AbortError")); return; }
    const next = socketFactory(REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${secret}`,
    ]);
    if (refinement) refinementSocket = next;
    else socket = next;
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      abort.signal.removeEventListener("abort", cancel);
      reject(new Error(message));
    };
    const cancel = () => fail("Transcription connection cancelled");
    const timeout = setTimeout(() => {
      fail("Transcription connection timed out");
    }, 10_000);
    abort.signal.addEventListener("abort", cancel, { once: true });
    next.onopen = () => {
      settled = true;
      clearTimeout(timeout);
      abort.signal.removeEventListener("abort", cancel);
      resolve();
    };
    next.onerror = () => {
      if (!settled) {
        fail("Transcription connection failed");
      } else if (!closing && !refinement) {
        void stop();
        options.onError("Transcription connection failed");
      }
    };
    next.onclose = () => {
      if (!settled) fail("Transcription connection closed");
      else if (!closing && !refinement) {
        void stop();
        options.onError("Transcription connection closed");
      }
    };
    next.onmessage = ({ data }) => {
      if (closing) return;
      let event: Record<string, unknown>;
      try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      if (event.type === "session.updated") {
        configuration.acknowledge(next);
        if (!refinement) configured = true;
        return;
      }
      if (event.type === "error") {
        if (!refinement && !configured && !usedCompatibilityFallback) {
          const detail = typeof event.error === "object" && event.error !== null
            ? event.error as Record<string, unknown> : {};
          logDiagnostic(
            "ERROR",
            `Conversate config rejected · code ${String(detail.code ?? "unknown").slice(0, 80)}`
              + ` · param ${String(detail.param ?? "unknown").slice(0, 120)}`,
          );
          usedCompatibilityFallback = true;
          sendLiveConfiguration(false);
        } else if (!refinement) options.onError("Transcription session error");
        return;
      }
      const itemId = typeof event.item_id === "string" ? event.item_id : "";
      if (!itemId) return;
      const stream = refinement ? "refinement" : "live";
      if (event.type === "input_audio_buffer.committed") {
        turnMatcher.acknowledge(stream, itemId);
        return;
      }
      if (!refinement && event.type === "conversation.item.input_audio_transcription.delta") {
        const delta = typeof event.delta === "string" ? event.delta : "";
        const text = `${partials.get(itemId) ?? ""}${delta}`;
        partials.set(itemId, text);
        options.onPartial(itemId, text);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        const text = typeof event.transcript === "string"
          ? event.transcript.trim()
          : (partials.get(itemId) ?? "").trim();
        if (!refinement) partials.delete(itemId);
        if (text && refinement) {
          turnMatcher.complete(stream, itemId, text);
        } else if (text) {
          options.onCompleted(itemId, text);
          turnMatcher.complete(stream, itemId, text);
        }
      }
    };
  });

  return {
    async start() {
      if (closing || starting || socket) throw new Error("Transcription session is already used");
      starting = true;
      try {
      const models = await resolveOpenAiModels(options.key, fetchImpl, abort.signal);
      options.onModels?.(models);
      const [secret, refinementSecret] = await Promise.all([
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
        }),
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
          transcriptionModel: "gpt-transcribe",
        }).catch(() => undefined),
      ]);
      abort.signal.throwIfAborted();
      await openSocket(secret);
      if (refinementSecret) await openSocket(refinementSecret, true).catch(() => {
        refinementSocket?.close();
        refinementSocket = undefined;
      });
      abort.signal.throwIfAborted();
      sendLiveConfiguration(true);
      send(refinementSocket, {
        type: "session.update",
        session: {
          type: "transcription",
          audio: { input: {
            format: { type: "audio/pcm", rate: 24_000 },
            transcription: {
              model: "gpt-transcribe",
              ...(options.prompt ? { prompt: options.prompt } : {}),
              ...(languages.length ? { languages } : {}),
              ...(keywords.length ? { keywords } : {}),
            },
            turn_detection: null,
          } },
        },
      });
      await configuration.wait([socket, refinementSocket].filter(value => value !== undefined), abort.signal);
      abort.signal.throwIfAborted();
      unsubscribe = options.bridge.onEvenHubEvent((event) => {
        const audio = event.audioEvent;
        if (!microphoneOpen || socket?.readyState !== SOCKET_OPEN || !audio
          || audio.source !== AudioInputSource.Glasses || audio.audioPcm.length === 0
          || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES) return;
        const decision = localVad(audio.audioPcm);
        for (const chunk of decision.audio) {
          const bytes = resamplePcm16Le16To24(chunk);
          if (!bytes.length) continue;
          const append = createAudioAppendEvent(bytes);
          send(socket, append);
          send(refinementSocket, append);
        }
        if (decision.commit) {
          if (refinementSocket?.readyState === SOCKET_OPEN) turnMatcher.commit();
          const commit = { type: "input_audio_buffer.commit" };
          send(socket, commit);
          send(refinementSocket, commit);
        }
      });
      microphoneActivation = options.bridge.audioControl(true, AudioInputSource.Glasses);
      microphoneOpen = await microphoneActivation;
      microphoneActivation = undefined;
      abort.signal.throwIfAborted();
      if (!microphoneOpen) throw new Error("G2 microphone unavailable");
      } catch (error) {
        await stop();
        throw error;
      } finally {
        starting = false;
      }
    },
    stop,
  };
}
