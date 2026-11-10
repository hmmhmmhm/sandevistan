import { describe, expect, it } from "vitest";
import {
  createConversateSnapshot,
  DEFAULT_CONVERSATE_SETTINGS,
  normalizeConversateSettings,
} from "./conversate-state";

describe("Conversate settings", () => {
  it("defaults every requested feature on and bounds editable values", () => {
    expect(DEFAULT_CONVERSATE_SETTINGS).toMatchObject({
      transcription: true, translation: true, inform: true, prepNote: true, copilot: true,
    });
    expect(normalizeConversateSettings({
      informSeconds: 200,
      goal: `  ${"x".repeat(600)}  `,
      prepNoteText: " note ",
      spokenLanguages: " ko, en ",
      transcriptionKeywords: " Sandevistan, G2 ",
    })).toMatchObject({ informSeconds: 60, prepNoteText: "note" });
    expect(normalizeConversateSettings({ goal: "x".repeat(600) }).goal).toHaveLength(500);
    expect(normalizeConversateSettings({ transcription: false }).transcription).toBe(true);
    expect(createConversateSnapshot()).toMatchObject({
      transcriptOffset: 0, copilotOpen: false,
    });
  });
});

it("rejects malformed persisted Copilot records while accepting older sessions without them", async () => {
  const { resolveConversateHistory } = await import("./conversate-state");
  const old = { id:"old",startedAt:"2026-11-08",endedAt:"2026-11-08",segments:[],informs:[] };
  let value = JSON.stringify([old]);
  const storage = { getLocalStorage: async () => value, setLocalStorage: async () => true };
  expect(await resolveConversateHistory(storage)).toHaveLength(1);
  value = JSON.stringify([{ ...old,copilotHistory:[{ id:"bad",at:"now",suggestions:[{ original:42 }] }] }]);
  expect(await resolveConversateHistory(storage)).toEqual([]);
});
