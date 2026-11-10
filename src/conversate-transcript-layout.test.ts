import { expect, it } from "vitest";
import { createConversateSnapshot, type ConversateSnapshot } from "./conversate-state";
import { conversateTranscriptRows, scrollConversateTranscript, visibleConversateTranscript } from "./conversate-transcript-layout";
it("stacks all wrapped source and translation rows and moves exactly one row per scroll", () => {
  let snapshot: ConversateSnapshot = { ...createConversateSnapshot(), segments: Array.from({ length: 4 }, (_, i) => ({ id: String(i), text: `Original ${i}`, translation: `Translation ${i}`, at: "2026-11-08" })) };
  const rows = conversateTranscriptRows(snapshot);
  expect(rows).toHaveLength(8);
  const latest = visibleConversateTranscript(snapshot, rows);
  snapshot = { ...snapshot, ...scrollConversateTranscript(snapshot, rows, -1) };
  const previous = visibleConversateTranscript(snapshot, rows);
  expect(previous.at(-1)).toEqual(latest.at(-2));
  snapshot = { ...snapshot, partial: "New sentence while browsing", partialItemId: "new", activeInform: { id: "tip", text: "A new tip", at: "now" } };
  expect(visibleConversateTranscript(snapshot, conversateTranscriptRows(snapshot))).toEqual(previous);
  snapshot = { ...snapshot, ...scrollConversateTranscript(snapshot, conversateTranscriptRows(snapshot), 1) };
  expect(snapshot.transcriptOffset).toBe(1);
});
it("retains a completed translation beside its own source while a new partial is appended", () => {
  const snapshot = { ...createConversateSnapshot(), segments: [{ id: "old", text: "Old source", translation: "Old translation", at: "now" }], partial: "New partial", partialItemId: "new" };
  expect(conversateTranscriptRows(snapshot).map(r => r.text)).toEqual(["Old source", "→ Old translation", "New partial"]);
});
it("keeps the latest heard source visible even when its translation exceeds the four-row viewport", () => {
  const snapshot = { ...createConversateSnapshot(), segments: [{ id:"long",at:"now",text:"The latest source",translation:"A long translation sentence. ".repeat(30) }] };
  const visible = visibleConversateTranscript(snapshot,conversateTranscriptRows(snapshot));
  expect(visible.length).toBeLessThanOrEqual(4);
  expect(visible.some(r => r.text === "The latest source")).toBe(true);
  expect(visible.some(r => r.translation)).toBe(true);
});
