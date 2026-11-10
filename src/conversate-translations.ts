import type { ConversateAnalysis } from "./conversate-analysis";
import type { ConversateSegment } from "./conversate-state";

export function createConversateTranslations(options: {
  readonly segments: () => readonly ConversateSegment[];
  readonly request: (segment: ConversateSegment, context: readonly ConversateSegment[], signal: AbortSignal,
    partial: (translation: string) => void) => Promise<ConversateAnalysis>;
  readonly apply: (segment: ConversateSegment, translation: string | undefined, language?: string) => void;
  readonly failed: () => void;
}) {
  const pending = new Map<string, ConversateSegment>();
  const completed = new Map<string, string>();
  let active: { controller: AbortController; segment: ConversateSegment } | undefined;
  let disposed = false;
  const pump = async () => {
    if (disposed || active) return;
    const segment = pending.values().next().value;
    if (!segment) return;
    pending.delete(segment.id);
    const all = options.segments();
    const index = all.findIndex(item => item.id === segment.id);
    if (index < 0) { void pump(); return; }
    const controller = new AbortController();
    active = { controller, segment };
    const valid = () => !disposed && !controller.signal.aborted
      && options.segments().some(item => item.id === segment.id && item.text === segment.text);
    try {
      const result = await options.request(segment, all.slice(Math.max(0, index - 7), index + 1), controller.signal, text => {
        if (valid()) options.apply(segment, text);
      });
      if (valid()) {
        completed.set(segment.id, segment.text);
        options.apply(segment, result.translation, result.language);
      }
    } catch { if (!controller.signal.aborted) options.failed(); }
    finally { active = undefined; if (!disposed) void pump(); }
  };
  return {
    enqueue(segment: ConversateSegment) {
      if (disposed || completed.get(segment.id) === segment.text
        || (active?.segment.id === segment.id && active.segment.text === segment.text)) return;
      const retained = new Set(options.segments().map(item => item.id));
      for (const id of pending.keys()) if (!retained.has(id)) pending.delete(id);
      for (const id of completed.keys()) if (!retained.has(id)) completed.delete(id);
      pending.set(segment.id, segment);
      void pump();
    },
    dispose() { disposed = true; pending.clear(); completed.clear(); active?.controller.abort(); },
  };
}
