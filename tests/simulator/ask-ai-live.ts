import { AudioEvent, AudioInputSource, waitForEvenAppBridge, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { createAiRuntime } from "../../src/ai-runtime";
import { createAiRealtimeSession } from "../../src/ai-realtime-session";
import { createDefaultRealtimeSocket, type RealtimeSocket } from "../../src/ai-realtime-transport";
import { createRealtimeProtocolState } from "../../src/ai-realtime-protocol";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
import { createInitialLiveDashboardState } from "../../src/live-state";
import { createConversateSnapshot } from "../../src/conversate-state";
import { createFastHudViewState, syncFastHudView, type FastHudViewState } from "../../src/fast-hud-view";
import { drawFastHudSurface } from "../../src/fast-hud-render";
import { createFastHudInputController } from "../../src/fast-hud-input-controller";
import { transmitFastCanvas, type FastCanvasRefreshRequest } from "../../src/glasses";
import { encodeCanvasTiles } from "../../src/g2-canvas";
const bridge = await waitForEvenAppBridge();
const canvas = document.querySelector("canvas");
if (!canvas) throw Error("Canvas missing");
const weatherMode = new URL(location.href).searchParams.has("weather");
const followup = weatherMode || new URL(location.href).searchParams.has("followup");
const exitOnly = new URL(location.href).searchParams.has("exitOnly");
const hold = followup || new URL(location.href).searchParams.has("hold");
const dual = hold || new URL(location.href).searchParams.has("dual");
const comparison = new URL(location.href).searchParams.has("compare");
const audioRoot = weatherMode ? "ask-ai-weather-2026-11-08" : followup ? "ask-ai-followup-2026-11-08" : exitOnly ? "ask-ai-hold-exit-2026-11-08" : hold ? "ask-ai-hold-2026-11-08" : dual ? "ask-ai-dual-2026-11-08" : comparison ? "ask-ai-asr-2026-11-08" : "ask-ai-live-2026-11-08";
const origin = "http://127.0.0.1:9899";
const headers = { "Content-Type": "application/json", "x-sandevistan-verifier": "memory-only" };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const live = createInitialLiveDashboardState();
let key: string | undefined;
let listener: ((event: EvenHubEvent) => void) | undefined;
let microphone = false;
let snapshot = createAiHudSnapshot(true);
let protocol = createRealtimeProtocolState();
let view: FastHudViewState = { ...createFastHudViewState(), mode: "ai" };
let refresh: FastCanvasRefreshRequest | undefined;
let socket: RealtimeSocket | undefined;
let frameText = "";
let frameComplete = false;
let framePhase = snapshot.phase;
let exitRequested = false;
let captures = Promise.resolve();
const storage = new Map<string, string>();
const timeline: unknown[] = [];
const checks: unknown[] = [];
const toolCalls: unknown[] = [];
let effectiveCaptionModel: string | undefined,effectiveLiveModel: string | undefined;
let imageAckDelay=0,busyScrollInputs=0;
const scrollInputs: {input:string;active:number;line:number}[]=[];
const scrollChecks: Record<string,boolean|number>={};
const imageStats = { sends: 0, active: 0, maxActive: 0, nativeText: 0, rebuilds: 0 };
type Timing = { name: string; started: number; ready?: number; speechEnd?: number; firstServerText?: number; firstGlassText?: number;
  finalServerText?: number; finalGlassText?: number; exitReceived?: number; socketClose?: number; micClose?: number; dashboard?: number;
  holdStarted?: number; holdReleased?: number; micOffBeforeHold?: boolean; noAnswerBeforeRelease?: boolean; livePreviewBeforeRelease?: boolean;
  liveCaptionModel?: string; livePartialEvents?: number; finalInput?: string;
  captionModel?: string; textDone?: number; metadataDropped?: number;
  exitWhileGenerating?: boolean; activeImagesAtExit?: number; firstGlassCharacters?: number; };
let timing: Timing = { name: "initial", started: performance.now() };
const captured = new Set<string>();
function capture(label: string) {
  if (captured.has(label)) return;
  captured.add(label);
  const value = { label, snapshot, view, frameText, frameComplete, timing: { ...timing }, imageStats: { ...imageStats }, canvasPng: canvas?.toDataURL("image/png") };
  captures = captures.then(async () => {
    await delay(120);
    await fetch(origin + "/capture", { method: "POST", headers, body: JSON.stringify(value) });
  });
}
const update = bridge.updateImageRawData.bind(bridge);
bridge.updateImageRawData = async value => {
  imageStats.sends++; imageStats.active++; imageStats.maxActive = Math.max(imageStats.maxActive, imageStats.active);
  try { const result=await update(value); if(imageAckDelay) await delay(imageAckDelay); return result; } finally { imageStats.active--; }
};
const upgrade = bridge.textContainerUpgrade.bind(bridge);
bridge.textContainerUpgrade = value => { imageStats.nativeText++; return upgrade(value); };
const rebuild = bridge.rebuildPageContainer.bind(bridge);
bridge.rebuildPageContainer = value => { imageStats.rebuilds++; return rebuild(value); };
function context() { return { newsCount: 0, newsPageCounts: [], todoCount: 0, maneuverCount: 0, activeManeuverIndex: 0, aiLineCount: snapshot.transcriptLines.length }; }
function draw() {
  if (!canvas) return;
  view = syncFastHudView(view, context());
  frameText = snapshot.assistantText; frameComplete = snapshot.responseComplete; framePhase = snapshot.phase;
  drawFastHudSurface({ canvas, page: "ai", view, live, ai: snapshot, conversate: createConversateSnapshot(), mapRadiusMeters: 650, locale: "ko" });
}
const runtime = createAiRuntime({
  bridge: {
    audioControl: async open => { microphone = open; if (!open) timing.micClose = performance.now(); return true; },
    onEvenHubEvent: next => { listener = next; return () => { listener = undefined; }; },
    getLocalStorage: async name => storage.get(name) ?? "",
    setLocalStorage: async (name, value) => { storage.set(name, value); return true; },
  },
  getKey: () => key, getLocale: () => "ko", getSnapshot: () => snapshot, onSnapshot: next => { snapshot = next; },
  refresh: () => refresh?.("all"),
  createSession: options => createAiRealtimeSession({ ...options, captureMode: hold ? "hold" : "automatic",
    createSocket: (url, protocols) => {
      const current = createDefaultRealtimeSocket(url, protocols);
      const isLive = url.includes("intent=transcription");
      if (!isLive) socket = current;
      if (current instanceof WebSocket) current.addEventListener("message", event => {
        const value = JSON.parse(String(event.data));
        if (value.type === "session.updated") {
          if (isLive) effectiveLiveModel = timing.liveCaptionModel = value.session?.audio?.input?.transcription?.model;
          else effectiveCaptionModel = timing.captionModel = value.session?.audio?.input?.transcription?.model;
        }
        if (!isLive && value.type === "response.done") {
          for (const call of value.response?.output ?? []) if (call.type === "function_call") toolCalls.push({name:timing.name,tool:call.name,arguments:call.arguments});
        }
        if (isLive && value.type === "conversation.item.input_audio_transcription.delta") timing.livePartialEvents = (timing.livePartialEvents ?? 0) + 1;
      });
      if (comparison && current instanceof WebSocket) current.addEventListener("message", event => {
        const value = JSON.parse(String(event.data));
        if (value.type === "session.updated") timing.captionModel = value.session?.audio?.input?.transcription?.model;
        if (timing.name === "metadata" && value.type === "response.done") {
          timing.metadataDropped = performance.now(); event.stopImmediatePropagation();
        }
      });
      const send = current.send.bind(current);
      current.send = text => {
        const value = JSON.parse(text);
        if (!isLive && value.type === "conversation.item.create" && value.item?.type === "function_call_output") toolCalls.push({name:timing.name,output:JSON.parse(value.item.output)});
        if (!isLive && value.type === "conversation.item.create" && value.item?.role === "user") timing.finalInput = value.item.content?.[0]?.text;
        if (comparison && timing.name.startsWith("live-") && value.type === "session.update") {
          value.session.audio.input.transcription.model = "gpt-live-transcribe";
          value.session.audio.input.transcription.delay = "medium";
        }
        send(JSON.stringify(value));
      };
      const close = current.close.bind(current);
      current.close = () => { timing.socketClose = performance.now(); close(); };
      return current;
    },
    onState: (next, eventType) => {
      protocol = next;
      if (next.captureState === "recording" && timing.holdStarted === undefined) timing.holdStarted = performance.now();
      if (next.captureState === "finishing" && timing.holdReleased === undefined) timing.holdReleased = performance.now();
      const at = performance.now();
      if (hold && timing.name === "exit" && eventType === "response.created" && !exitRequested) {
        exitRequested = true; console.info("LIVE_READY_TO_EXIT");
      }
      if (eventType === "response.output_text.done") timing.textDone = at;
      if (next.phase === "listening" && timing.ready === undefined) timing.ready = at;
      if ((!followup || timing.holdReleased !== undefined) && next.assistantText && timing.firstServerText === undefined) timing.firstServerText = at;
      if ((!followup || timing.holdReleased !== undefined) && next.responseComplete && timing.finalServerText === undefined) timing.finalServerText = at;
      timeline.push({ name: timing.name, at, eventType, phase: next.phase, model: next.model,
        user: next.userText, answer: next.assistantText, complete: next.responseComplete, error: next.error });
      options.onState?.(next, eventType);
    },
  }),
});
const input = createFastHudInputController({ getView: () => view, setView: next => {
  if (view.mode === "ai" && next.mode === "dashboard") {
    timing.exitReceived = performance.now();
    timing.exitWhileGenerating = protocol.phase === "thinking" && !protocol.responseComplete && Boolean(protocol.activeResponseId);
    timing.activeImagesAtExit = imageStats.active;
    console.info("LIVE_EXIT_RECEIVED");
  }
  view = next;
}, getPage: () => "ai", getContext: context, getLiveSession: () => undefined, getAiRuntime: () => runtime, drawCurrentPage: draw });
draw();
const disposeImages = await transmitFastCanvas(canvas, () => {}, async () => {}, {
  dependencies: { waitForBridge: async () => bridge, encode: encodeCanvasTiles }, imageSendConcurrency: 4, tilePaletteMode: "hud-4",
  canHandleBusyInput: input => {const accepted=view.mode === "ai" && (input === "scroll-next" || input === "scroll-previous");if(accepted)busyScrollInputs++;return accepted;},
  beforeExternalRefresh: draw, onRefreshReady: value => { refresh = value; }, onInput: async value => {
    const active=imageStats.active;const result=await input(value);
    if(value.startsWith("scroll"))scrollInputs.push({input:value,active,line:view.aiLine});
    return result;
  },
  onDisplayCommitted: () => {
    const at = performance.now();
    if (view.mode === "dashboard" && timing.exitReceived !== undefined && timing.dashboard === undefined) {
      timing.dashboard = at; capture("exit-dashboard");
    }
    if (view.mode !== "ai" || (followup && timing.holdReleased === undefined)) return;
    if (framePhase === "listening" && !frameText) capture(timing.name + "-ready");
    if (frameText && timing.firstGlassText === undefined) {
      timing.firstGlassText = at; timing.firstGlassCharacters = [...frameText].length;
      capture(timing.name + "-first-answer");
    }
    if (frameText && frameComplete) { timing.finalGlassText ??= at; capture(timing.name + "-final-answer"); }
    if (timing.name === "exit" && frameText && !protocol.responseComplete && protocol.phase === "thinking" && !exitRequested) {
      exitRequested = true;
      void captures.then(() => {
        if (!protocol.responseComplete && view.mode === "ai") console.info("LIVE_READY_TO_EXIT");
      });
    }
  },
});
async function waitFor(test: () => boolean, timeout = 60_000) {
  const start = performance.now();
  while (!test()) {
    if (snapshot.phase === "error") throw Error(snapshot.error ?? "AI session failed");
    if (performance.now() - start > timeout) throw Error("Live observation timeout");
    await delay(25);
  }
}
async function inject(name: string) {
  const bytes = await fetch(`/output/${audioRoot}/${name}.pcm`).then(r => r.arrayBuffer());
  const raw = new DataView(bytes);
  const samples = Math.floor(bytes.byteLength / 3);
  const pcm = new Uint8Array(samples * 2 + 192_000);
  const target = new DataView(pcm.buffer);
  let lastVoicedByte = 0;
  for (let index = 0; index < samples; index++) {
    const value = raw.getInt16(Math.floor(index * 1.5) * 2, true);
    target.setInt16(index * 2, value, true);
    if (Math.abs(value) >= 300) lastVoicedByte = index * 2 + 2;
  }
  for (let offset = 0; offset < pcm.length; offset += 3200) {
    if (!microphone || !listener) {
      if (name === "exit" && view.mode === "dashboard") return;
      throw Error("Synthetic audio ownership lost");
    }
    if (timing.speechEnd === undefined && offset + 3200 >= lastVoicedByte) timing.speechEnd = performance.now();
    listener({ audioEvent: new AudioEvent({ audioPcm: pcm.slice(offset, offset + 3200), source: AudioInputSource.Glasses }) });
    await delay(100);
  }
}
let error: string | undefined;
try {
  const credential = await fetch(origin + "/key", { headers }).then(r => r.json());
  key = credential.key;
  for (const name of (weatherMode ? ["short","weather","umbrella"] : followup ? ["short","english"] : exitOnly ? ["exit"] : dual ? ["short", "english", "mixed", "exit"] : comparison ? ["default-english", "live-english", "default-mixed", "live-mixed", "metadata"] : ["short", "explain", "exit"])) {
    view = { ...createFastHudViewState(), mode: "ai" };
    timing = { name, started: performance.now(), captionModel:effectiveCaptionModel, liveCaptionModel:effectiveLiveModel };
    if ((!followup || name === "short") && !await runtime.start()) throw Error("Live startup failed");
    await waitFor(() => snapshot.phase === "listening");
    await captures;
    if (hold) {
      timing.micOffBeforeHold = !microphone;
      capture(name + "-waiting");
      console.info("LIVE_READY_TO_HOLD " + name);
      await waitFor(() => snapshot.captureState === "recording");
    }
    await inject(name);
    if (hold) {
      timing.noAnswerBeforeRelease = !snapshot.assistantText && !protocol.activeResponseId;
      timing.livePreviewBeforeRelease = Boolean(snapshot.userText);
      capture(name + "-held-caption");
      console.info("LIVE_READY_TO_RELEASE " + name);
      await waitFor(() => !microphone);
    }
    if (name === "metadata") {
      await waitFor(() => timing.metadataDropped !== undefined && timing.firstGlassText !== undefined);
      await delay(21_000);
      const preserved = snapshot.phase === "listening" && !snapshot.error && snapshot.assistantText.trim() === "2";
      capture("metadata-answer-preserved");
      checks.push({ ...timing, correct: preserved, responseComplete: snapshot.responseComplete, answer: snapshot.assistantText, phase: snapshot.phase });
      await runtime.stop();
    } else if (name === "exit") {
      await waitFor(() => timing.dashboard !== undefined, 30_000);
      await waitFor(() => socket?.readyState === 3 && !microphone && !listener, 5000);
      if (!timing.exitWhileGenerating) throw Error("Exit did not occur during active generation");
      if (snapshot.phase !== "idle") throw Error("Stale active indicator after exit");
      const saved = { ...timing };
      await delay(1000);
      checks.push({ ...saved, microphoneStopped: !microphone, audioUnsubscribed: !listener, socketClosed: socket?.readyState === 3, stayedOnDashboard: view.mode === "dashboard", dashboardIndicatorIdle: snapshot.phase === "idle" });
    } else {
      await waitFor(() => snapshot.responseComplete && timing.finalGlassText !== undefined && snapshot.assistantText===protocol.assistantText && frameText===protocol.assistantText);
      const user = snapshot.userText, answer = snapshot.assistantText;
      const weatherOutputs=toolCalls.filter((value):value is {name:string;output:{ok:true;data:{current:{temperature:number}}}}=>!!value&&typeof value==="object"&&"name" in value&&value.name===name&&"output" in value&&!!value.output&&typeof value.output==="object"&&"ok" in value.output&&value.output.ok===true&&"data" in value.output&&!!value.output.data&&typeof value.output.data==="object"&&"current" in value.output.data&&!!value.output.data.current&&typeof value.output.data.current==="object"&&"temperature" in value.output.data.current&&typeof value.output.data.current.temperature==="number");
      const currentWeather=weatherOutputs.at(-1)?.output.data.current.temperature;
      const degrees=[...answer.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:℃|°C|도)/g)].map(m=>Number(m[1]));
      const correct = weatherMode && name !== "short" ? /우산|기온|온도|°|도/.test(answer) && !/제공할수|제공할수는|확인할수|알려드릴수|접근할수/.test(answer.replace(/\s+/g,""))
        && (name!=="weather" || (currentWeather!==undefined && degrees.some(n=>Math.abs(n-currentWeather)<=.6) && /\[\d+\]|Open.Meteo/i.test(answer)))
        : dual && (name === "english" || name === "mixed")
        ? (name === "english" ? /Tuesday/i.test(user) && /3|three/i.test(user) && /budget/i.test(user) : /목요일/.test(user) && /10|열/.test(user) && /110|백십/.test(user))
        : comparison
        ? (name.endsWith("english") ? /Tuesday/i.test(user) && /3|three/i.test(user) && /budget/i.test(user)
          : /목요일/.test(user) && /10|열/.test(user) && /110|백십/.test(user) && /net revenue retention/i.test(user))
        : name === "short" ? /^2[.!]?$/.test(answer.trim()) : /빛|산란|파장/.test(answer);
      checks.push({ ...timing, user, answer, correct: correct && (!hold || (timing.micOffBeforeHold && timing.noAnswerBeforeRelease && timing.livePreviewBeforeRelease)) && timing.finalInput === user && timing.liveCaptionModel === "gpt-live-transcribe" && (timing.livePartialEvents ?? 0) > 0, recordingSeconds: snapshot.recording?.seconds });
      await captures;
      if(weatherMode && name==="weather") {
        imageAckDelay=200;
        const before=view.aiLine,count=Math.min(9,before),start=scrollInputs.length;
        console.info(`LIVE_SCROLL_REQUEST up:${count}`);
        await waitFor(()=>scrollInputs.length>=start+count,10000);await delay(600);
        scrollChecks.allUpSteps=view.aiLine===before-count;capture("rapid-scroll-up");
        console.info(`LIVE_SCROLL_REQUEST down:${count}`);
        await waitFor(()=>scrollInputs.length>=start+count*2,10000);await delay(600);
        scrollChecks.allDownSteps=view.aiLine===before;scrollChecks.busyInputsExercised=busyScrollInputs>0;scrollChecks.busyScrollInputs=busyScrollInputs;scrollChecks.events=scrollInputs.length;
        imageAckDelay=0;
      }
      if (!followup || name === (weatherMode ? "umbrella" : "english")) await runtime.stop();
      if (microphone || listener) throw Error("Microphone remained after stop");
    }
    await captures;
    console.info("LIVE_PASS_DONE " + name);
  }
} catch (value) { error = value instanceof Error ? value.message : "Unknown live failure"; }
finally { await runtime.stop(); runtime.dispose(); key = undefined; await captures; disposeImages(); }
const ok = !error && (!weatherMode || (scrollChecks.allUpSteps && scrollChecks.allDownSteps && scrollChecks.busyInputsExercised)) && checks.length === (weatherMode ? 3 : followup ? 2 : exitOnly ? 1 : dual ? 4 : comparison ? 5 : 3) && checks.every(value => typeof value === "object" && value !== null && (!("correct" in value) || value.correct));
await fetch(origin + "/result", { method: "POST", headers, body: JSON.stringify({ ok, error, checks, timeline, toolCalls, scrollChecks, scrollInputs, imageStats,
  microphoneStopped: !microphone, audioUnsubscribed: !listener,
  source: "Fresh OpenAI TTS 24k PCM to SDK 16k audio events; real OpenAI Realtime, production runtime/view/input/image path; simulated microphone acknowledgements, no physical microphone" }) });
const output = document.getElementById("status");
if (output) output.textContent = JSON.stringify({ ok, error, checks }, null, 2);
console.info("LIVE_ALL_DONE");
