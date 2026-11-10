import { requestRealtimeClientSecret } from "./ai-realtime-token";
import { createRealtimeConfigurationGate } from "./realtime-configuration-gate";
import type { RealtimeSocket } from "./ai-realtime-transport";

type Options = {
  key: string;
  fetchImpl: typeof fetch;
  createSocket: (url: string, protocols: string[]) => RealtimeSocket;
  onPartial: (itemId: string, text: string) => void;
  onError: () => void;
  onUsage?: () => void;
};

export function createAiLiveCaptions(options: Options) {
  let socket: RealtimeSocket | undefined;
  let abort = new AbortController();
  let active: string | undefined;
  let closed = true;
  const pending: string[] = [];
  const committed = new Set<string>();
  const finalized = new Set<string>();
  const bindings = new Map<string, string>();
  const partials = new Map<string, string>();
  const charged = new Set<string>();
  const send = (event: unknown) => {
    if (!closed && socket?.readyState === 1) socket.send(JSON.stringify(event));
  };
  const stop = () => {
    closed = true; abort.abort(); socket?.close(); socket = undefined;
    active = undefined; pending.length = 0; committed.clear(); finalized.clear(); bindings.clear(); partials.clear(); charged.clear();
  };
  return {
    stop,
    clear() { send({ type: "input_audio_buffer.clear" }); active = undefined; partials.clear(); },
    rebind(previous: string, next: string) {
      if (active === previous) active = next;
      for (const [id, main] of bindings) if (main === previous) bindings.set(id, next);
    },
    append: send,
    handlePrimary(event: unknown) {
      if (closed || !event || typeof event !== "object" || !("type" in event)
        || !("item_id" in event) || typeof event.item_id !== "string") return;
      const id = event.item_id;
      if (event.type === "input_audio_buffer.speech_started") active = id;
      if (event.type === "input_audio_buffer.committed" && !committed.has(id)) {
        committed.add(id); pending.push(id); send({ type: "input_audio_buffer.commit" });
        if (committed.size > 200) committed.delete(committed.values().next().value ?? "");
      }
      if (event.type === "conversation.item.input_audio_transcription.completed") {
        finalized.add(id);
        if (finalized.size > 200) finalized.delete(finalized.values().next().value ?? "");
      }
    },
    async start(signal: AbortSignal) {
      stop(); abort = new AbortController(); closed = false;
      const cancel = () => stop();
      signal.addEventListener("abort", cancel, { once: true });
      const gate = createRealtimeConfigurationGate<RealtimeSocket>();
      try {
        if (signal.aborted) throw new Error("Caption startup cancelled");
        const secret = await requestRealtimeClientSecret({ key: options.key, fetchImpl: options.fetchImpl,
          signal: abort.signal, purpose: "transcription", transcriptionModel: "gpt-live-transcribe" });
        abort.signal.throwIfAborted();
        const next = options.createSocket("wss://api.openai.com/v1/realtime?intent=transcription", ["realtime", `openai-insecure-api-key.${secret}`]);
        socket = next;
        const fail = () => { if (!closed) { stop(); options.onError(); } };
        next.onopen = () => send({ type: "session.update", session: { type: "transcription", audio: { input: {
          format: { type: "audio/pcm", rate: 24_000 },
          transcription: { model: "gpt-live-transcribe", delay: "medium",
            prompt: "Live human conversation. Transcribe faithfully in the languages spoken. Preserve code-switching, names, numbers, and dates. Do not translate." },
          turn_detection: null,
        } } } });
        next.onerror = fail; next.onclose = fail;
        next.onmessage = ({ data }) => {
          if (closed) return;
          let event: unknown;
          try { event = JSON.parse(data); } catch { return; }
          if (!event || typeof event !== "object" || !("type" in event)) return;
          if (event.type === "session.updated") { gate.acknowledge(next); return; }
          if (event.type === "error") { fail(); return; }
          if (!("item_id" in event) || typeof event.item_id !== "string") return;
          const id = event.item_id;
          if (event.type === "input_audio_buffer.committed") {
            const main = pending.shift();
            if (main) bindings.set(id, main);
            while (bindings.size > 200) bindings.delete(bindings.keys().next().value ?? "");
          }
          if (event.type === "conversation.item.input_audio_transcription.delta" && "delta" in event && typeof event.delta === "string") {
            const text = `${partials.get(id) ?? ""}${event.delta}`.slice(0, 4_000);
            partials.set(id, text);
            const main = bindings.get(id) ?? active;
            if (main === active && main && !finalized.has(main)) {
              bindings.set(id, main); options.onPartial(main, text);
            }
            while (partials.size > 200) partials.delete(partials.keys().next().value ?? "");
          }
          if (event.type === "conversation.item.input_audio_transcription.completed") {
            partials.delete(id);
            if (!charged.has(id)) { charged.add(id); options.onUsage?.(); }
            while (charged.size > 200) charged.delete(charged.values().next().value ?? "");
          }
        };
        await gate.wait([next], abort.signal);
      } catch (error) { stop(); throw error; }
      finally { signal.removeEventListener("abort", cancel); }
    },
  };
}
