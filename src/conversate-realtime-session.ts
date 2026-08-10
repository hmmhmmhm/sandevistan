import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import {
  createAudioAppendEvent,
  createPcm16Le16To24Resampler,
} from "./ai-realtime-audio";
import { requestRealtimeClientSecret } from "./ai-realtime-token";
import {
  createDefaultRealtimeSocket,
  type RealtimeSocket,
} from "./ai-realtime-transport";
import { logDiagnostic } from "./diagnostic-log";
import type { PhoneLocale } from "./phone-types";
import { createConversateLocalVad } from "./conversate-local-vad";

const REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;

type Bridge = {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

type ConfigurationWaiter = {
  resolve(): void;
  reject(error: Error): void;
};

type CompletedLiveTurn = {
  readonly itemId: string;
  readonly text: string;
};

function resemblesSameTurn(first: string, second: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const left = normalize(first);
  const right = normalize(second);
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  for (let index = 0; index + 1 < left.length; index += 1) {
    if (right.includes(left.slice(index, index + 2))) return true;
  }
  return false;
}

export type ConversateRealtimeSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

export function createConversateRealtimeSession(options: {
  readonly bridge: Bridge;
  readonly key: string;
  readonly locale: PhoneLocale;
  readonly prompt?: string;
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
  let closing = false;
  const partials = new Map<string, string>();
  const liveItems: CompletedLiveTurn[] = [];
  const refinedTurns: string[] = [];
  let configured = false;
  let usedCompatibilityFallback = false;
  let liveConfigurationWaiter: ConfigurationWaiter | undefined;
  let refinementConfigurationWaiter: ConfigurationWaiter | undefined;
  const abort = new AbortController();
  const localVad = createConversateLocalVad();
  const resampler = createPcm16Le16To24Resampler();
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

  const waitForConfiguration = (refinement: boolean) => new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error("Transcription configuration timed out");
      if (refinement) refinementConfigurationWaiter = undefined;
      else liveConfigurationWaiter = undefined;
      reject(error);
    }, 5_000);
    const waiter: ConfigurationWaiter = {
      resolve: () => {
        clearTimeout(timeout);
        if (refinement) refinementConfigurationWaiter = undefined;
        else liveConfigurationWaiter = undefined;
        resolve();
      },
      reject: (error) => {
        clearTimeout(timeout);
        if (refinement) refinementConfigurationWaiter = undefined;
        else liveConfigurationWaiter = undefined;
        reject(error);
      },
    };
    if (refinement) refinementConfigurationWaiter = waiter;
    else liveConfigurationWaiter = waiter;
  });

  const sendLiveConfiguration = (extended: boolean) => {
    configured = false;
    send(socket, {
      type: "session.update",
      session: {
        type: "transcription",
        audio: { input: {
          format: { type: "audio/pcm", rate: 24_000 },
          noise_reduction: { type: "far_field" },
          transcription: {
            model: "gpt-live-transcribe",
            delay: extended ? "high" : "medium",
            ...(extended && options.prompt ? { prompt: options.prompt } : {}),
            ...(extended && languages.length ? { languages } : {}),
            ...(extended && keywords.length ? { keywords } : {}),
          },
          turn_detection: null,
        } },
      },
    });
  };

  const publishRefinements = () => {
    while (liveItems.length && refinedTurns.length) {
      const refined = refinedTurns[0];
      const index = liveItems.findIndex((turn) => resemblesSameTurn(turn.text, refined ?? ""));
      if (index < 0) return;
      const [turn] = liveItems.splice(index, 1);
      refinedTurns.shift();
      if (turn && refined) options.onRefined(turn.itemId, refined);
    }
  };

  const closeMicrophone = async () => {
    if (!microphoneOpen) return;
    await options.bridge.audioControl(false).catch(() => false);
    microphoneOpen = false;
  };

  const openSocket = (secret: string, refinement = false) => new Promise<void>((resolve, reject) => {
    const next = socketFactory(REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${secret}`,
    ]);
    if (refinement) refinementSocket = next;
    else socket = next;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error("Transcription connection timed out"));
    }, 10_000);
    next.onopen = () => {
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    next.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Transcription connection failed"));
      } else if (!closing && !refinement) options.onError("Transcription connection failed");
    };
    next.onclose = () => {
      if (!settled) reject(new Error("Transcription connection closed"));
      else if (!closing && !refinement) options.onError("Transcription connection closed");
    };
    next.onmessage = ({ data }) => {
      let event: Record<string, unknown>;
      try { event = JSON.parse(data) as Record<string, unknown>; } catch { return; }
      if (event.type === "session.updated") {
        if (refinement) refinementConfigurationWaiter?.resolve();
        else {
          configured = true;
          liveConfigurationWaiter?.resolve();
        }
        return;
      }
      if (event.type === "error") {
        if (refinement) {
          refinementConfigurationWaiter?.reject(new Error("Refinement configuration rejected"));
          return;
        }
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
        } else if (!refinement) {
          liveConfigurationWaiter?.reject(new Error("Transcription session error"));
          options.onError("Transcription session error");
        }
        return;
      }
      if (event.type === "conversation.item.input_audio_transcription.failed") {
        const detail = typeof event.error === "object" && event.error !== null
          ? event.error as Record<string, unknown> : {};
        logDiagnostic(
          "ERROR",
          `Conversate transcription failed · code ${String(detail.code ?? "unknown").slice(0, 80)}`,
        );
        return;
      }
      const itemId = typeof event.item_id === "string" ? event.item_id : "";
      if (!itemId) return;
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
          refinedTurns.push(text);
          publishRefinements();
        } else if (text) {
          options.onCompleted(itemId, text);
          liveItems.push({ itemId, text });
          publishRefinements();
        }
      }
    };
  });

  return {
    async start() {
      const [secret, refinementSecret] = await Promise.all([
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
        }),
        requestRealtimeClientSecret({
          fetchImpl, key: options.key, signal: abort.signal, purpose: "transcription",
          transcriptionModel: "gpt-transcribe",
        }).catch(() => undefined),
      ]);
      await openSocket(secret);
      if (refinementSecret) await openSocket(refinementSecret, true).catch(() => {
        refinementSocket?.close();
        refinementSocket = undefined;
      });
      const liveConfiguration = waitForConfiguration(false);
      sendLiveConfiguration(true);
      await liveConfiguration;
      if (refinementSocket) {
        const refinementConfiguration = waitForConfiguration(true);
        send(refinementSocket, {
          type: "session.update",
          session: {
            type: "transcription",
            audio: { input: {
              format: { type: "audio/pcm", rate: 24_000 },
            noise_reduction: { type: "far_field" },
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
        await refinementConfiguration.catch(() => {
          logDiagnostic("ERROR", "Conversate refinement unavailable");
          refinementSocket?.close();
          refinementSocket = undefined;
        });
      }
      unsubscribe = options.bridge.onEvenHubEvent((event) => {
        const audio = event.audioEvent;
        if (!microphoneOpen || socket?.readyState !== SOCKET_OPEN || !audio
          || audio.source !== AudioInputSource.Glasses || audio.audioPcm.length === 0
          || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES) return;
        const decision = localVad(audio.audioPcm);
        if (decision.started) resampler.reset();
        for (const chunk of decision.audio) {
          const bytes = resampler.push(chunk);
          if (!bytes.length) continue;
          const append = createAudioAppendEvent(bytes);
          send(socket, append);
          send(refinementSocket, append);
        }
        if (decision.commit) {
          const final = resampler.flush();
          if (final.length) {
            const append = createAudioAppendEvent(final);
            send(socket, append);
            send(refinementSocket, append);
          }
          const commit = { type: "input_audio_buffer.commit" };
          send(socket, commit);
          send(refinementSocket, commit);
        }
      });
      microphoneOpen = await options.bridge.audioControl(true, AudioInputSource.Glasses);
      if (!microphoneOpen) throw new Error("G2 microphone unavailable");
    },
    async stop() {
      closing = true;
      abort.abort();
      unsubscribe?.();
      unsubscribe = undefined;
      socket?.close();
      socket = undefined;
      refinementSocket?.close();
      refinementSocket = undefined;
      await closeMicrophone();
    },
  };
}
