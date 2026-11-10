import { wrapHudTextByWidth } from "./fast-detail-text";
import type { ConversateSnapshot } from "./conversate-state";

export type ConversateTranscriptRow = { readonly key: string; readonly text: string; readonly translation: boolean };
const caches = new WeakMap<CanvasRenderingContext2D, Map<string, readonly string[]>>();
const fallback = new Map<string, readonly string[]>();
export function conversateTranscriptRows(snapshot: ConversateSnapshot, translation = true, context?: CanvasRenderingContext2D): readonly ConversateTranscriptRow[] {
  let cache = context ? caches.get(context) : fallback;
  if (!cache) { cache = new Map(); if (context) caches.set(context, cache); }
  const rows: ConversateTranscriptRow[] = [];
  const append = (id: string, value: string, translated: boolean) => {
    const size = translated ? 16 : 17, key = `${size}:${value}`;
    let lines = cache.get(key);
    if (!lines) {
      if (context) context.font = `bold ${size}px "SFMono-Regular", Consolas, monospace`;
      lines = wrapHudTextByWidth(value, s => context ? context.measureText(s).width
        : [...s].reduce((n,c) => n + (c.charCodeAt(0) < 128 ? size * .61 : size), 0), 528, 128);
      cache.set(key, lines);
      while (cache.size > 600) cache.delete(cache.keys().next().value ?? "");
    }
    lines.forEach((text, index) => rows.push({ key: `${id}:${translated ? "translation" : "source"}:${index}`, text, translation: translated }));
  };
  for (const segment of snapshot.segments) {
    append(segment.id, segment.text, false);
    if (translation && segment.translation) append(segment.id, `→ ${segment.translation}`, true);
  }
  if (snapshot.partial) append(snapshot.partialItemId ?? "partial", snapshot.partial, false);
  return rows;
}
export function visibleConversateTranscript(snapshot: ConversateSnapshot, rows: readonly ConversateTranscriptRow[]) {
  const anchored = snapshot.transcriptAnchor ? rows.findIndex(row => row.key === snapshot.transcriptAnchor) : -1;
  const end = anchored >= 0 ? anchored + 1 : Math.max(1, rows.length - snapshot.transcriptOffset);
  const visible = rows.slice(Math.max(0, end - 4), end);
  if (!snapshot.transcriptAnchor && !snapshot.transcriptOffset && visible.length === 4 && visible.every(row => row.translation)) {
    let source = rows.length - 1;
    while (source >= 0 && rows[source]?.translation) source--;
    if (source >= 0) return [...rows.slice(Math.max(0, source - 1), source + 1).filter(row => !row.translation), ...visible.slice(-2)];
  }
  return visible;
}
export function scrollConversateTranscript(snapshot: ConversateSnapshot, rows: readonly ConversateTranscriptRow[], delta: -1 | 1): Partial<ConversateSnapshot> {
  const anchored = snapshot.transcriptAnchor ? rows.findIndex(row => row.key === snapshot.transcriptAnchor) : -1;
  const current = anchored >= 0 ? anchored : rows.length - 1 - snapshot.transcriptOffset;
  const next = Math.max(Math.min(3, rows.length - 1), Math.min(rows.length - 1, current + delta));
  return { transcriptAnchor: next < rows.length - 1 ? rows[next]?.key : undefined,
    transcriptOffset: Math.max(0, rows.length - 1 - next) };
}
