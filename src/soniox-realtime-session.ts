import { AudioInputSource, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createDefaultRealtimeSocket, type RealtimeSocket } from "./ai-realtime-transport";
import { logDiagnostic } from "./diagnostic-log";

const SONIOX_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
const SOCKET_OPEN = 1;
const MAX_PCM_CHUNK_BYTES = 65_536;

type Bridge = {
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>;
  onEvenHubEvent(listener: (event: EvenHubEvent) => void): () => void;
};

export type SonioxRealtimeSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

type SonioxToken = { readonly text?: unknown; readonly is_final?: unknown };

export function createSonioxRealtimeSession(options: {
  readonly bridge: Bridge;
  readonly key: string;
  readonly onPartial: (itemId: string, text: string) => void;
  readonly onCompleted: (itemId: string, text: string) => void;
  readonly onError: (message: string) => void;
  readonly createSocket?: (url: string, protocols: string[]) => RealtimeSocket;
}): SonioxRealtimeSession {
  const socketFactory = options.createSocket ?? createDefaultRealtimeSocket;
  let socket: RealtimeSocket | undefined;
  let unsubscribe: (() => void) | undefined;
  let microphoneOpen = false;
  let closing = false;
  let finalText = "";
  let turn = 0;

  const stopMicrophone = async () => {
    if (!microphoneOpen) return;
    await options.bridge.audioControl(false).catch(() => false);
    microphoneOpen = false;
  };

  return {
    start: () => new Promise<void>((resolve, reject) => {
      const next = socketFactory(SONIOX_URL, []);
      socket = next;
      const timeout = setTimeout(() => reject(new Error("Soniox connection timed out")), 10_000);
      next.onopen = () => {
        clearTimeout(timeout);
        next.send(JSON.stringify({
          api_key: options.key,
          model: "stt-rt-v5",
          audio_format: "pcm_s16le",
          sample_rate: 16_000,
          num_channels: 1,
          enable_language_identification: true,
          enable_endpoint_detection: true,
          endpoint_latency_adjustment_level: 0,
          max_endpoint_delay_ms: 2_000,
        }));
        unsubscribe = options.bridge.onEvenHubEvent((event) => {
          const audio = event.audioEvent;
          if (!microphoneOpen || next.readyState !== SOCKET_OPEN || !audio
            || audio.source !== AudioInputSource.Glasses || !audio.audioPcm.length
            || audio.audioPcm.length > MAX_PCM_CHUNK_BYTES) return;
          next.send(audio.audioPcm);
        });
        void options.bridge.audioControl(true, AudioInputSource.Glasses).then((opened) => {
          microphoneOpen = opened;
          if (opened) resolve();
          else reject(new Error("G2 microphone unavailable"));
        });
      };
      next.onerror = () => {
        if (!closing) options.onError("Soniox transcription connection failed");
        reject(new Error("Soniox transcription connection failed"));
      };
      next.onclose = () => {
        if (!closing) options.onError("Soniox transcription connection closed");
      };
      next.onmessage = ({ data }) => {
        let event: { tokens?: unknown; error_message?: unknown };
        try { event = JSON.parse(data) as typeof event; } catch { return; }
        if (typeof event.error_message === "string") {
          logDiagnostic("ERROR", `Soniox transcription failed · ${event.error_message.slice(0, 120)}`);
          return;
        }
        if (!Array.isArray(event.tokens)) return;
        const tokens = event.tokens as SonioxToken[];
        const final = tokens.filter((token) => token.is_final === true)
          .map((token) => typeof token.text === "string" ? token.text : "");
        const partial = tokens.filter((token) => token.is_final !== true)
          .map((token) => typeof token.text === "string" ? token.text : "").join("");
        const endpoint = final.includes("<end>");
        finalText += final.filter((text) => text !== "<end>").join("");
        const visible = `${finalText}${partial}`.trim();
        if (visible) options.onPartial(`soniox-${turn + 1}`, visible);
        if (endpoint) {
          const completed = finalText.trim();
          if (completed) options.onCompleted(`soniox-${++turn}`, completed);
          finalText = "";
        }
      };
    }),
    async stop() {
      closing = true;
      unsubscribe?.();
      unsubscribe = undefined;
      if (socket?.readyState === SOCKET_OPEN) socket.send(JSON.stringify({ type: "finalize" }));
      socket?.close();
      socket = undefined;
      await stopMicrophone();
    },
  };
}
