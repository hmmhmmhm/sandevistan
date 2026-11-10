import { writeFile } from "node:fs/promises";
const root = "output/simulator-audit-2026-11-08";

async function post(path, key, body) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45_000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status} code ${String(value.error?.code ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60)}`);
  return value;
}

export async function runLiveCommand(command, key) {
  if (command === "assistant") return verifyAssistant(key);
  if (command === "browser") return verifyBrowser(key);
  if (command === "audio" || command === "audio-noise" || command === "audio-hints") return verifySyntheticConversate(key, command);
  if (command === "probe") {
    for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
      const value = await post("responses", key, {
        model, input: "Reply with just OK.", reasoning: { effort: "low" }, max_output_tokens: 128,
      });
      console.log(JSON.stringify({ role: "text", requested: model, actual: value.model, status: value.status }));
    }
    for (const [model, session] of [
      ["gpt-realtime-2.1", { type: "realtime", model: "gpt-realtime-2.1" }],
      ["gpt-live-transcribe", { type: "transcription", audio: { input: { transcription: { model: "gpt-live-transcribe" } } } }],
    ]) {
      const value = await post("realtime/client_secrets", key, { session });
      console.log(JSON.stringify({ role: "realtime-secret", requested: model, valid: typeof value.value === "string" }));
    }
  }
  if (command === "tts") {
    for (const [name, text] of [
      ["en", "Our meeting is next Friday at three PM. Could you explain what a vector database is?"],
      ["ko", "다음 주 금요일 오후 세 시에 회의가 있어요. 벡터 데이터베이스가 무엇인지 설명해 주시겠어요?"],
      ["mixed", "이번 분기 revenue target은 이십 퍼센트 증가예요. Can we review the timeline next Friday?"],
    ]) {
      const model = "gpt-realtime-2.1-mini";
      const secret = await post("realtime/client_secrets", key, { session: { type: "realtime", model } });
      const chunks = [];
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, ["realtime", `openai-insecure-api-key.${secret.value}`]);
        const timer = setTimeout(() => { socket.close(); reject(new Error("TTS_TIMEOUT")); }, 45_000);
        const finish = (error) => { clearTimeout(timer); socket.close(); error ? reject(error) : resolve(); };
        socket.onopen = () => socket.send(JSON.stringify({ type: "response.create", response: {
          output_modalities: ["audio"],
          instructions: `Read exactly this text, without adding or answering anything: ${text}`,
        } }));
        socket.onmessage = ({ data }) => {
          const event = JSON.parse(data);
          if ((event.type === "response.output_audio.delta" || event.type === "response.audio.delta") && event.delta) chunks.push(Buffer.from(event.delta, "base64"));
          if (event.type === "error") finish(new Error(`TTS_ERROR ${event.error?.code ?? "unknown"}`));
          if (event.type === "response.done") finish(event.response?.status === "failed" ? new Error("TTS_RESPONSE_FAILED") : undefined);
        };
        socket.onerror = () => finish(new Error("TTS_SOCKET_ERROR"));
      });
      const bytes = Buffer.concat(chunks);
      if (!bytes.length) throw new Error("TTS_EMPTY_AUDIO");
      await writeFile(`${root}/${name === "quiet" || name === "noise" ? "en" : name}-tts-24k.pcm`, bytes);
      await writeFile(`${root}/${name}-reference.txt`, text);
      console.log(JSON.stringify({ sample: name, source: "AI-generated TTS", bytes: bytes.length, seconds: bytes.length / 48_000 }));
    }
  }
}

async function verifySyntheticConversate(key, mode) {
  const { createServer } = await import("vite");
  const { readFile } = await import("node:fs/promises");
  const { setTimeout: delay } = await import("node:timers/promises");
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error" });
  const realFetch = globalThis.fetch;
  let runtime;
  let writer = Promise.resolve();
  try {
    const { createConversateRuntime } = await server.ssrLoadModule("/src/conversate-runtime.ts");
    const { createConversateSnapshot, DEFAULT_CONVERSATE_SETTINGS } = await server.ssrLoadModule("/src/conversate-state.ts");
    const { AudioEvent, AudioInputSource } = await import("@evenrealities/even_hub_sdk");
    let listener;
    let snapshot = createConversateSnapshot();
    const settings = { ...DEFAULT_CONVERSATE_SETTINGS, ...(mode === "audio-hints" ? { transcriptionKeywords: "revenue target, vector database, timeline", goal: "Discuss revenue targets, vector databases, and meeting schedules." } : {}), spokenLanguages: "ko,en", informSeconds: 15, copilot: true, translation: true, inform: true };
    const storage = new Map();
    const history = [];
    let revision = 0;
    const started = performance.now();
    runtime = createConversateRuntime({
      bridge: {
        audioControl: async () => true,
        onEvenHubEvent: (next) => { listener = next; return () => { listener = undefined; }; },
        getLocalStorage: async (name) => storage.get(name) ?? "",
        setLocalStorage: async (name, value) => { storage.set(name, value); return true; },
      },
      getKey: () => key, getLocale: () => "ko", getSettings: () => settings,
      getSnapshot: () => snapshot,
      onSnapshot: (next) => {
        snapshot = next;
        const record = { revision: ++revision, elapsedMs: Math.round(performance.now() - started), snapshot: next, settings };
        history.push(record);
        writer = writer.then(() => writeFile(`${root}/live-snapshot.json`, JSON.stringify(record)));
      },
      refresh: async () => { await writer; },
    });
    if (!await runtime.start()) throw new Error("LIVE_START_FAILED");
    console.log("Live production Conversate runtime started; synthetic SDK audio only");
    const injected = [];
    const inject = async (bytes) => {
      injected.push(Buffer.from(bytes));
      for (let offset = 0; offset < bytes.length; offset += 3_200) {
        listener?.({ audioEvent: new AudioEvent({ audioPcm: bytes.slice(offset, offset + 3_200), source: AudioInputSource.Glasses }) });
        await delay(100);
      }
    };
    const samples = mode === "audio-noise" ? ["quiet", "noise"] : ["en", "ko", "mixed"];
    for (const name of samples) {
      const caseStart = injected.length;
      const pcm = new Uint8Array(await readFile(`${root}/${name === "quiet" || name === "noise" ? "en" : name}-tts-24k.pcm`));
      const input = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      const count = Math.floor(pcm.length / 3);
      const resampled = new Uint8Array(count * 2);
      const output = new DataView(resampled.buffer);
      for (let i = 0; i < count; i++) {
        const position = i * 1.5;
        const lower = Math.min(Math.floor(position), pcm.length / 2 - 1);
        const upper = Math.min(lower + 1, pcm.length / 2 - 1);
        output.setInt16(i * 2, Math.round(input.getInt16(lower * 2, true) * (1 - position % 1) + input.getInt16(upper * 2, true) * (position % 1)), true);
      }
      let seed = 12345;
      const background = (length) => {
        const bytes = new Uint8Array(length);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < length; i += 2) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          view.setInt16(i, Math.round(((seed / 0x100000000) * 2 - 1) * 680), true);
        }
        return bytes;
      };
      if (name === "quiet") {
        for (let i = 0; i < resampled.length; i += 2) output.setInt16(i, Math.round(output.getInt16(i, true) * 0.18), true);
      }
      if (name === "noise") {
        await inject(background(38_400));
        const noise = new DataView(background(resampled.length).buffer);
        for (let i = 0; i < resampled.length; i += 2) output.setInt16(i, Math.max(-32768, Math.min(32767, output.getInt16(i, true) + noise.getInt16(i, true))), true);
      }
      await inject(resampled);
      await inject(name === "noise" ? background(38_400) : new Uint8Array(38_400));
      await writeFile(`${root}/${mode}-${name}-sdk16k.pcm`, Buffer.concat(injected.slice(caseStart)));
      console.log(JSON.stringify({ injected: name, completedSegments: snapshot.segments.length, phase: snapshot.phase }));
    }
    for (let i = 0; i < (mode === "audio-noise" ? 60 : 80) && (snapshot.segments.length < samples.length || !snapshot.segments.at(-1)?.translation || snapshot.suggestions.length < 3) && snapshot.phase !== "error"; i++) await delay(250);
    await writer;
    await writeFile(`${root}/${mode}-timeline.json`, JSON.stringify(history, null, 2));
    console.log(JSON.stringify({ phase: snapshot.phase, segments: snapshot.segments, informs: snapshot.informs, suggestions: snapshot.suggestions }));
    const screenshot = await realFetch("http://127.0.0.1:9898/api/screenshot/glasses");
    await writeFile(`${root}/${mode}-final.png`, Buffer.from(await screenshot.arrayBuffer()));
    await runtime.stop();
  } catch (error) {
    console.log(String(error?.message ?? "unknown").split(key).join("[REDACTED]").slice(0, 250));
    throw error;
  } finally {
    runtime?.dispose();
    await writer;
    globalThis.fetch = realFetch;
    await server.close();
  }
}

async function verifyBrowser(key) {
  const { createServer } = await import("node:http");
  let used = false;
  let finish;
  const result = new Promise((resolve) => { finish = resolve; });
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin !== "http://127.0.0.1:4179") { response.writeHead(403).end(); return; }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sandevistan-verifier");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.headers["x-sandevistan-verifier"] !== "memory-only") { response.writeHead(403).end(); return; }
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/key" && !used) {
      used = true;
      response.end(JSON.stringify({ key }));
    } else if (request.url === "/result" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 32_000) { response.writeHead(413).end(); finish(); return; }
      }
      const value = JSON.parse(body);
      const safe = JSON.stringify(value).split(key).join("[REDACTED]");
      await writeFile(`${root}/browser-ai-result.json`, safe);
      console.log(safe);
      response.end('{"ok":true}');
      finish();
    } else response.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(9899, "127.0.0.1", resolve));
  console.log("Browser one-shot credential handoff ready");
  const timer = setTimeout(() => finish(), 120_000);
  try { await result; }
  finally {
    clearTimeout(timer);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function verifyAssistant(key) {
  const { createServer } = await import("vite");
  const { readFile } = await import("node:fs/promises");
  const { setTimeout: delay } = await import("node:timers/promises");
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error" });
  let session;
  let writer = Promise.resolve();
  try {
    const { createAiRealtimeSession } = await server.ssrLoadModule("/src/ai-realtime-session.ts");
    const { createDefaultRealtimeSocket } = await server.ssrLoadModule("/src/ai-realtime-transport.ts");
    const { createAiHudSnapshot, updateAiHudProtocol } = await server.ssrLoadModule("/src/ai-hud-state.ts");
    const { AudioEvent, AudioInputSource } = await import("@evenrealities/even_hub_sdk");
    let listener;
    let snapshot = createAiHudSnapshot(true);
    const timeline = [];
    let revision = 0;
    const wire = { sent: {}, received: {} };
    session = createAiRealtimeSession({
      key, locale: "ko",
      createSocket: (url, protocols) => {
        const socket = createDefaultRealtimeSocket(url, protocols);
        const send = socket.send.bind(socket);
        socket.send = (data) => {
          const event = JSON.parse(data);
          wire.sent[event.type] = (wire.sent[event.type] ?? 0) + 1;
          send(data);
        };
        socket.addEventListener("message", ({ data }) => {
          const event = JSON.parse(data);
          wire.received[event.type] = (wire.received[event.type] ?? 0) + 1;
          if (event.type === "error") console.log(JSON.stringify({ code: event.error?.code, param: event.error?.param }));
        });
        return socket;
      },
      bridge: {
        audioControl: async () => true,
        onEvenHubEvent: (next) => { listener = next; return () => { listener = undefined; }; },
      },
      onState: (protocol) => {
        snapshot = updateAiHudProtocol(snapshot, protocol);
        const record = { revision: ++revision, kind: "assistant", snapshot };
        timeline.push(record);
        writer = writer.then(() => writeFile(`${root}/live-snapshot.json`, JSON.stringify(record)));
      },
    });
    await session.start();
    const bytes = await readFile(`${root}/en-tts-24k.pcm`);
    const input = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pcm = new Uint8Array(Math.floor(bytes.length / 3) * 2 + 64_000);
    const output = new DataView(pcm.buffer);
    for (let i = 0; i < Math.floor(bytes.length / 3); i++) output.setInt16(i * 2, input.getInt16(Math.floor(i * 1.5) * 2, true), true);
    for (let offset = 0; offset < pcm.length; offset += 3_200) {
      listener?.({ audioEvent: new AudioEvent({ audioPcm: pcm.slice(offset, offset + 3_200), source: AudioInputSource.Glasses }) });
      await delay(100);
    }
    for (let i = 0; i < 160 && !snapshot.responseComplete && snapshot.phase !== "error"; i++) await delay(250);
    await writer;
    await writeFile(`${root}/assistant-live-timeline.json`, JSON.stringify(timeline, null, 2));
    console.log(JSON.stringify({ wire, assistant: { phase: snapshot.phase, user: snapshot.userText, answer: snapshot.assistantText, complete: snapshot.responseComplete, error: snapshot.error } }));
    const screenshot = await fetch("http://127.0.0.1:9898/api/screenshot/glasses");
    await writeFile(`${root}/assistant-live-final.png`, Buffer.from(await screenshot.arrayBuffer()));
  } finally {
    await session?.stop();
    await writer;
    await server.close();
  }
}
