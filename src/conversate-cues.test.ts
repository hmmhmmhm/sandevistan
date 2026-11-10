import { expect, it, vi } from "vitest";
import { createConversateSnapshot, type ConversateSnapshot } from "./conversate-state";
import { createConversateCues } from "./conversate-cues";
import { conversateDirectoryEntries, tapConversateDirectory, scrollConversateDirectory } from "./conversate-history";

it("hides timed cards without removing their records or transcript, and reopens both through a directory", async () => {
  vi.useFakeTimers();
  let snapshot: ConversateSnapshot = { ...createConversateSnapshot(), segments: [{ id: "turn", text: "Keep this sentence", at: new Date().toISOString() }] };
  const cues = createConversateCues({ snapshot: () => snapshot, publish: patch => { snapshot = { ...snapshot, ...patch }; }, seconds: () => 10 });
  try {
    cues.inform({ id: "inform1", text: "Useful information", at: new Date().toISOString() }, true);
    cues.copilot("copilot1", [{ original: "A reply", pronunciation: "a", meaning: "reply", style: "direct" }], true);
    expect(snapshot.activeInform?.expiresAt).toBe(Date.now() + 10000);
    const originalExpiry = snapshot.activeInform?.expiresAt;
    await vi.advanceTimersByTimeAsync(4000);
    cues.inform({ id: "inform1", text: "More useful information", at: new Date().toISOString() }, true);
    expect(snapshot.activeInform?.expiresAt).toBe(originalExpiry);
    await vi.advanceTimersByTimeAsync(6001);
    expect(snapshot.activeInform).toBeUndefined(); expect(snapshot.suggestions).toEqual([]);
    expect(snapshot.segments[0]?.text).toBe("Keep this sentence");
    expect(conversateDirectoryEntries(snapshot)).toHaveLength(2);
    snapshot = { ...snapshot, ...tapConversateDirectory(snapshot) };
    expect(snapshot.directory?.mode).toBe("list");
    snapshot = { ...snapshot, ...scrollConversateDirectory(snapshot, 1), ...{} };
    snapshot = { ...snapshot, ...tapConversateDirectory(snapshot) };
    expect(["inform", "copilot"]).toContain(snapshot.directory?.mode);
    cues.inform({ id: "inform1", text: "Late final", at: new Date().toISOString() }, true);
    expect(snapshot.activeInform).toBeUndefined(); expect(snapshot.informs[0]?.text).toBe("Late final");
  } finally { cues.dispose(); vi.useRealTimers(); }
});
it("excludes disabled cue types from directory selection and stops scrolling at the last Inform row", () => {
  const snapshot = { ...createConversateSnapshot(), informs: [{ id:"info",at:"2026-11-08",text:"Saved" }],
    copilotHistory: [{ id:"reply",at:"2026-11-08",suggestions:[{ original:"Saved reply",pronunciation:"reply",meaning:"reply",style:"direct" }] }] };
  const selected = tapConversateDirectory(snapshot,{ inform:false,copilot:true });
  expect(selected.directory).toEqual({ mode:"list",selectedId:"reply" });
  const opened = { ...snapshot,directory:{ mode:"inform" as const,id:"info",row:2 } };
  expect(scrollConversateDirectory(opened,1,undefined,6).directory).toEqual(opened.directory);
});
