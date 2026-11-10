export type AiCaptureState = "waiting" | "starting" | "recording" | "finishing";

export function createAiHoldCapture(options: {
  ready(): boolean;
  open(): Promise<boolean>;
  close(): Promise<boolean>;
  clear(): void;
  commit(): void;
  onBegin(id: string): void;
  onCommitted(previousId: string, itemId: string): void;
  onStatus(state: AiCaptureState): void;
  onError(message: string): void;
}) {
  let status: AiCaptureState = "waiting", held = false, bytes = 0, sequence = 0;
  let id = "", committedId = "", disposed = false, finalized = false;
  let closing: Promise<void> | undefined;
  let limit: ReturnType<typeof setTimeout> | undefined;
  const update = (next: AiCaptureState) => { status = next; if (!disposed) options.onStatus(next); };
  const maybeReady = () => { if (!disposed && !held && status === "finishing" && finalized && !closing) update("waiting"); };
  const close = () => {
    closing ??= options.close().then(ok => { if (!ok && !disposed) options.onError("Could not close G2 microphone"); })
      .finally(() => { closing = undefined; maybeReady(); });
    return closing;
  };
  return {
    acceptsAudio() { return held && status === "recording" && !disposed; },
    countAudio(length: number) { bytes += length; },
    async begin() {
      if (disposed || !options.ready() || status !== "waiting") return;
      held = true; bytes = 0; id = `hold-${++sequence}`; committedId = ""; finalized = false;
      options.clear(); options.onBegin(id); update("starting");
      try {
        const opened = await options.open();
        if (disposed || !held) { close(); return; }
        if (!opened) throw new Error("G2 microphone unavailable");
        update("recording");
        limit = setTimeout(() => {
          held = false; options.clear(); close(); options.onError("Recording limit reached; release and try a shorter question");
        }, 120_000);
      } catch (error) { if (!disposed) options.onError(error instanceof Error ? error.message : "G2 microphone unavailable"); }
    },
    end() {
      if (disposed || !held) return;
      held = false; clearTimeout(limit);
      const enough = status === "recording" && bytes >= 3_200;
      finalized = !enough; update("finishing"); void close();
      if (enough) options.commit(); else options.clear();
    },
    handle(event: unknown) {
      if (disposed || !event || typeof event !== "object" || !("type" in event)
        || !("item_id" in event) || typeof event.item_id !== "string") return;
      if (status === "finishing" && event.type === "input_audio_buffer.committed" && !committedId) {
        committedId = event.item_id; options.onCommitted(id, committedId);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.item_id === committedId) { finalized = true; maybeReady(); }
    },
    dispose() { disposed = true; held = false; clearTimeout(limit); },
  };
}
