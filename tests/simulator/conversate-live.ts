import { aiDetailLines } from "../../src/fast-ai-detail-style";
import { conversateDirectoryEntries } from "../../src/conversate-history";
import { conversateTranscriptRows, visibleConversateTranscript } from "../../src/conversate-transcript-layout";
import { createConversateRealtimeSession } from "../../src/conversate-realtime-session";
import { createDefaultRealtimeSocket } from "../../src/ai-realtime-transport";
import { AudioEvent, AudioInputSource, waitForEvenAppBridge, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createConversateRuntime } from "../../src/conversate-runtime";
import { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS, type ConversateSnapshot } from "../../src/conversate-state";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createFastHudViewState } from "../../src/fast-hud-view";
import { drawFastHudSurface } from "../../src/fast-hud-render";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";
const bridge = await waitForEvenAppBridge();
const canvas = document.querySelector("canvas");
if (!canvas) throw Error("Canvas missing");
const ctx = canvas.getContext("2d");
if (!ctx) throw Error("Canvas context missing");
const historyMode = new URL(location.href).searchParams.has("history");
const audioRoot = historyMode ? "conversate-history-live-2026-11-08" : "conversate-live-2026-11-08";
const origin = "http://127.0.0.1:9899";
const headers = { "Content-Type": "application/json", "x-sandevistan-verifier": "memory-only" };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const now = () => Math.round(performance.now());
const settings = { ...DEFAULT_CONVERSATE_SETTINGS };
const storage = new Map<string, string>();
const live = createInitialLiveDashboardState();
const view = { ...createFastHudViewState(), mode: "conversate" as const };
let key: string | undefined, listener: ((event: EvenHubEvent) => void) | undefined;
let microphone = false, refresh: FastCanvasRefreshRequest | undefined;
let snapshot = createConversateSnapshot();
let frame: ConversateSnapshot = snapshot;
let texts: Array<{ value: string; y: number; size: number }> = [];
let captures = Promise.resolve();
let interactions = 0;
let error: string | undefined;
const timeline: Array<{ at: number; snapshot: ConversateSnapshot }> = [];
const visible: Array<{ at: number; partial: string; id?: string; text?: string; translation?: string; inform?: string; suggestions: number; transcriptMatched: boolean; copilotId?: string; texts: typeof texts }> = [];
const socketTrace: unknown[] = [];
let socketNumber = 0;
const inputs: Array<{ name: string; start: number; speechEnd?: number }> = [];
const captured = new Set<string>();
const imageStats = { sends: 0, active: 0, maxActive: 0, nativeText: 0, rebuilds: 0 };
const rawText = ctx.fillText.bind(ctx);
ctx.fillText = (value, x, y, maxWidth) => {
  texts.push({ value, y, size: Number(ctx.font.match(/(\d+)px/)?.[1] ?? 0) });
  if (maxWidth === undefined) rawText(value, x, y); else rawText(value, x, y, maxWidth);
};
const imageUpdate = bridge.updateImageRawData.bind(bridge);
bridge.updateImageRawData = async value => {
  imageStats.sends++; imageStats.active++; imageStats.maxActive = Math.max(imageStats.maxActive, imageStats.active);
  try { return await imageUpdate(value); } finally { imageStats.active--; }
};
const textUpdate = bridge.textContainerUpgrade.bind(bridge);
bridge.textContainerUpgrade = value => { imageStats.nativeText++; return textUpdate(value); };
const rebuild = bridge.rebuildPageContainer.bind(bridge);
bridge.rebuildPageContainer = value => { imageStats.rebuilds++; return rebuild(value); };
function capture(label: string) {
  if (captured.has(label)) return;
  captured.add(label);
  const value = { label, at: now(), snapshot: frame, texts: [...texts], imageStats: { ...imageStats }, canvasPng: canvas?.toDataURL("image/png") };
  captures = captures.then(async () => { await delay(120); await fetch(origin + "/capture", { method: "POST", headers, body: JSON.stringify(value) }); });
}
function draw() {
  if (!canvas) return;
  texts = []; frame = snapshot;
  drawFastHudSurface({ canvas, page: "conversate", view, live, ai: createAiHudSnapshot(false), conversate: frame,
    conversateSettings: settings, mapRadiusMeters: 650, locale: "ko" });
}
const runtime = createConversateRuntime({
  bridge: {
    audioControl: async open => { microphone = open; return true; },
    onEvenHubEvent: next => { listener = next; return () => { listener = undefined; }; },
    getLocalStorage: async name => storage.get(name) ?? "", setLocalStorage: async (name, value) => { storage.set(name, value); return true; },
  },
  getKey: () => key, getLocale: () => "ko", getSettings: () => settings, getSnapshot: () => snapshot,
  onSnapshot: next => { snapshot = next; timeline.push({ at: now(), snapshot: next }); },
  informLineCount: text => aiDetailLines(ctx,text,15,528,32).length,
  transcriptRows: value => conversateTranscriptRows(value,settings.translation,ctx),
  refresh: () => refresh?.("all"),
  createSession: options => createConversateRealtimeSession({ ...options, createSocket: (url, protocols) => {
    const socket = createDefaultRealtimeSocket(url, protocols), stream = ++socketNumber;
    if (socket instanceof WebSocket) socket.addEventListener("message", event => {
      try {
        const value = JSON.parse(String(event.data));
        socketTrace.push({ at: now(), stream, type: value.type, id: value.item_id,
          transcript: value.transcript, delta: value.delta, error: value.error?.code,
          configuredModel: value.session?.audio?.input?.transcription?.model,
          turnDetection: value.session?.audio?.input?.turn_detection });
      } catch {}
    });
    return socket;
  } }),
});
draw();
const disposeImages = await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles }, imageSendConcurrency: 4, tilePaletteMode: "hud-4",
  beforeExternalRefresh: draw, onRefreshReady: value => { refresh = value; },
  onInput: input => {
    interactions++;
    if (input === "tap") runtime.tap();
    else if (input === "scroll-next") runtime.scroll(1);
    else if (input === "scroll-previous") runtime.scroll(-1);
    return "redraw";
  },
  onDisplayCommitted: () => {
    const segment = frame.segments.at(-1);
    const record = { at: now(), partial: frame.partial, id: segment?.id, text: segment?.text,
      translation: segment?.translation, inform: frame.activeInform?.text, suggestions: frame.suggestions.length,
      transcriptMatched: JSON.stringify(texts.filter(t => t.y >= 143 && t.y < 220).map(t => t.value)) === JSON.stringify(visibleConversateTranscript(frame,conversateTranscriptRows(frame,settings.translation,ctx)).map(r => r.text)),
      copilotId: frame.activeCopilotId, texts: [...texts] };
    visible.push(record);
    if (frame.partial) capture("partial-caption");
    if (segment?.text) capture("first-caption");
    if (record.translation && texts.some(t => t.value.startsWith("→"))) capture("automatic-translation");
    if (record.inform) capture("automatic-inform");
    if (record.inform && record.translation && record.suggestions) capture("all-features");

  },
});
async function inject(name: string) {
  const record = { name, start: now(), speechEnd: undefined as number | undefined }; inputs.push(record);
  const bytes = await fetch(`/output/${audioRoot}/${name}.pcm`).then(r => r.arrayBuffer());
  const source = new DataView(bytes), count = Math.floor(bytes.byteLength / 3);
  const pcm = new Uint8Array(count * 2 + 51_200);
  const output = new DataView(pcm.buffer); let voicedEnd = 0;
  for (let index = 0; index < count; index++) {
    const value = source.getInt16(Math.floor(index * 1.5) * 2, true);
    output.setInt16(index * 2, value, true);
    if (Math.abs(value) >= 300) voicedEnd = index * 2 + 2;
  }
  for (let offset = 0; offset < pcm.length; offset += 3200) {
    if (!microphone || !listener) throw Error("Audio ownership lost");
    if (record.speechEnd === undefined && offset + 3200 >= voicedEnd) record.speechEnd = now();
    listener({ audioEvent: new AudioEvent({ source: AudioInputSource.Glasses, audioPcm: pcm.slice(offset, offset + 3200) }) });
    await delay(100);
  }
  console.info("CONVERSATE_INJECTED " + name);
}
let automaticInteractions = 0;
let automaticDirectoryClosed = true;
const historyChecks: Record<string,boolean> = {};
async function waitUntil(test: () => boolean, limit = 35_000) {
  const start = now();
  while (!test()) {
    if (snapshot.phase === "error") throw Error(snapshot.error ?? "Conversate failed");
    if (now()-start > limit) throw Error("Conversate verification timed out");
    await delay(50);
  }
}
let actionNumber = 0;
async function action(value: "click" | "up" | "down") {
  const previous = interactions;
  console.info(`CONVERSATE_ACTION_REQUEST ${++actionNumber}:${value}`);
  await waitUntil(() => interactions > previous,5000);
  await delay(200); await refresh?.("all"); await delay(150);
}
function viewport() { return visibleConversateTranscript(snapshot,conversateTranscriptRows(snapshot,settings.translation,ctx ?? undefined)).map(r => r.key); }
async function verifyHistory() {
  const before = viewport(); await action("up");
  const pinned = viewport();
  historyChecks.oneRowScroll = pinned.at(-1) === before.at(-2);
  const originalCount = snapshot.segments.length;
  await inject("revision"); await waitUntil(() => snapshot.segments.length > originalCount);
  historyChecks.pinnedDuringSpeech = JSON.stringify(viewport()) === JSON.stringify(pinned);
  for (let i=0;i<60 && (snapshot.transcriptAnchor || snapshot.transcriptOffset);i++) await action("down");
  historyChecks.resumedLatest = !snapshot.transcriptAnchor && snapshot.transcriptOffset === 0;
  const latestId = snapshot.segments.at(-1)?.id;
  await waitUntil(() => snapshot.segments.every(s => s.translation) && Boolean(snapshot.copilotHistory?.some(c => c.id === `${latestId}-copilot`)));
  const transcripts = snapshot.segments.map(s => s.text), informs = snapshot.informs.length, copilots = snapshot.copilotHistory?.length ?? 0;
  await delay(settings.informSeconds*1000+1500); await refresh?.("all"); capture("expired-cues-retained-transcript");
  historyChecks.expiryRetainsText = JSON.stringify(snapshot.segments.map(s => s.text)) === JSON.stringify(transcripts);
  historyChecks.expiryRetainsRecords = snapshot.informs.length >= informs && (snapshot.copilotHistory?.length ?? 0) >= copilots;
  historyChecks.liveCardsExpired = !snapshot.activeInform && !snapshot.suggestions.length;
  await action("click"); capture("directory-list");
  historyChecks.directoryOpened = snapshot.directory?.mode === "list";
  const entries = conversateDirectoryEntries(snapshot);
  for (const kind of ["copilot","inform"] as const) {
    const targetIndex = entries.findIndex((entry,index) => entry.kind === kind && index > 0);
    if (targetIndex < 0) throw Error(`Missing earlier ${kind} record`);
    const target = entries[targetIndex];
    if (!target) throw Error("History target missing");
    for (let i=0;i<60 && snapshot.directory?.mode === "list" && snapshot.directory.selectedId !== target.id;i++) await action("down");
    await action("click"); capture(`reopened-${kind}`);
    historyChecks[`reopened${kind}`] = snapshot.directory?.mode === kind && snapshot.directory.id === target.id;
    const content = kind === "inform" ? snapshot.informs.find(i => i.id === target.id)?.text : snapshot.copilotHistory?.find(c => c.id === target.id)?.suggestions[0]?.original;
    historyChecks[`visible${kind}`] = Boolean(content && texts.some(t => t.value.includes(content.slice(0,15))));
    if (kind === "copilot") {
      await action("down");
      historyChecks.copilotAlternatives = snapshot.directory?.mode === "copilot" && snapshot.directory.suggestion === 1;
    } else {
      await inject("term"); await delay(1500); await refresh?.("all"); capture("history-with-live-transcription");
      historyChecks.historyPinnedDuringSpeech = snapshot.directory?.mode === "inform" && snapshot.directory.id === target.id;
      historyChecks.recordNotTimedWhileOpen = Boolean(content && texts.some(t => t.value.includes(content.slice(0,15))));
    }
    await action("click");
    if (kind === "copilot") await action("click");
  }
  await waitUntil(() => snapshot.segments.every(s => s.translation));
  historyChecks.audioContinued = microphone && Boolean(listener) && snapshot.segments.length >= originalCount+2;
}
try {
  key = (await fetch(origin + "/key", { headers }).then(r => r.json())).key;
  if (!await runtime.start()) throw Error("Conversate startup failed");
  await refresh?.("all"); capture("ready");
  for (const name of ["schedule", "term", "revision", "mixed"]) {
    await inject(name);
    if (snapshot.phase === "error") throw Error(snapshot.error ?? "Conversate failed");
  }
  const latestId = snapshot.segments.at(-1)?.id;
  await waitUntil(() => snapshot.segments.length > 0 && snapshot.segments.every(s => s.translation) && Boolean(snapshot.copilotHistory?.some(c => c.id === `${latestId}-copilot`)));
  await refresh?.("all"); capture("settled"); await captures;
  automaticInteractions = interactions; automaticDirectoryClosed = !snapshot.directory;
  if (historyMode) await verifyHistory();
  else { await delay(11_000); await refresh?.("all"); capture("after-inform-timeout"); }
} catch (value) { error = value instanceof Error ? value.message : "Unknown failure"; }
const beforeStop = snapshot;
await runtime.stop(); runtime.dispose(); key = undefined; await captures; disposeImages();
const persisted = JSON.parse(storage.get("sandevistan:conversate-history:v1") ?? "[]");
if (historyMode) historyChecks.persistedBothCueTypes = Boolean(persisted[0]?.informs?.length && persisted[0]?.copilotHistory?.length);
const translated = beforeStop.segments.filter(s => s.translation);
const informFrames = visible.filter(v => v.inform);
const translationFrames = visible.filter(v => v.translation && v.texts.some(t => t.value.startsWith("→")));
function countdownAdvanced(kind: "Inform" | "Copilot") {
  const first = new Map<string,number>();
  for (const value of visible) {
    const id = kind === "Inform" ? value.inform : value.copilotId;
    const line = value.texts.find(t => t.value.startsWith(kind) && /초 후 숨김/.test(t.value));
    const seconds = Number(line?.value.match(/(\d+)초 후 숨김/)?.[1]);
    if (!id || !Number.isFinite(seconds)) continue;
    const previous = first.get(id);
    if (previous !== undefined && seconds < previous) return true;
    first.set(id,seconds);
  }
  return false;
}
const checks = {
  informCountdownAdvanced: countdownAdvanced("Inform"), copilotCountdownAdvanced: countdownAdvanced("Copilot"),
  recordingSeconds: beforeStop.recording?.seconds,
  recordingClockAdvanced: (beforeStop.recording?.seconds ?? 0) > 20,
  scheduleRecognized: beforeStop.segments.some(s => /Tuesday/i.test(s.text) && /3|three/i.test(s.text)),
  scheduleTranslated: translated.some(s => /Tuesday/i.test(s.text) && /화요일/.test(s.translation ?? "") && /3|세/.test(s.translation ?? "")),
  retentionTranslated: translated.filter(s => /110|one hundred and ten|백십/i.test(s.text)).every(s => /110|백십/.test(s.translation ?? "")),
  completedSegments: beforeStop.segments.length, translatedSegments: translated.length,
  allCompletedSegmentsTranslated: beforeStop.segments.length > 0 && translated.length === beforeStop.segments.length,
  partialCaptionUpdates: visible.filter(v => v.partial).length,
  automaticTranslationFrames: translationFrames.length, automaticInformFrames: informFrames.length,
  informHistory: beforeStop.informs.length, copilotSuggestions: Math.max(0,...(beforeStop.copilotHistory ?? []).map(c => c.suggestions.length)),
  copilotHistory: beforeStop.copilotHistory?.length ?? 0,
  mixedSourceDetected: beforeStop.segments.some(s => /그럼|목표|목요일/.test(s.text)),
  noManualInputs: automaticInteractions === 0, noSelectorsOpened: automaticDirectoryClosed,
  nativeHistoryInputs: interactions, historyChecks,
  followsLatest: beforeStop.transcriptOffset === 0,
  transcriptFramesMatched: visible.every(v => v.transcriptMatched),
  microphoneStopped: !microphone, audioUnsubscribed: !listener,
  noTextOverflow: visible.every(v => v.texts.every(t => t.y >= 0 && t.y + t.size <= 288)),
};
const ok = !error && checks.informCountdownAdvanced && checks.copilotCountdownAdvanced && checks.recordingClockAdvanced && checks.scheduleRecognized && checks.scheduleTranslated && checks.retentionTranslated && checks.completedSegments >= 4 && checks.allCompletedSegmentsTranslated
  && checks.automaticTranslationFrames > 0 && checks.automaticInformFrames > 0 && checks.copilotSuggestions === 3
  && checks.transcriptFramesMatched && (!historyMode || Object.values(historyChecks).every(Boolean)) && checks.noManualInputs && checks.followsLatest && checks.microphoneStopped && checks.audioUnsubscribed && checks.noTextOverflow;
await fetch(origin + "/result", { method: "POST", headers, body: JSON.stringify({ ok, error, checks, settings, inputs, timeline, visible, socketTrace, imageStats, final: beforeStop,
  source: "Real OpenAI live transcription, refinement and Responses analysis; task-cached TTS via SDK AudioEvent; real four-tile transport; simulated microphone acknowledgements; automatic speech phase followed by native simulator history gestures" }) });
const status = document.getElementById("status"); if (status) status.textContent = JSON.stringify({ ok, checks, error });
console.info("CONVERSATE_ALL_DONE");
