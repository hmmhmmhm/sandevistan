import { createInterface } from "node:readline";
import { createServer } from "node:http";
import { mkdir, writeFile, access } from "node:fs/promises";
const root = process.argv.includes("--image")
  ? "output/canvas-ai-implementation-2026-11-08"
  : "output/assistant-audit-2026-11-08";
await mkdir(root, { recursive: true });
const lines = createInterface({ input: process.stdin });
let key;
for await (const line of lines) { key = line.trim(); break; }
lines.close();
process.stdin.pause();
if (!key) throw new Error("Credential required on stdin");
const samples = [
  ["introduce-en", "My name is Alex. Please remember my name. Reply in one short sentence."],
  ["recall-en", "What is my name? Reply with only my name."],
  ["recall", "제 이름이 뭐죠? 이름만 답해 주세요."],
  ["short", "일 더하기 일은 얼마인가요? 숫자만 답해 주세요."],
];
try {
  for (const [name, text] of samples) {
    try { await access(`${root}/${name}.pcm`); continue; } catch {}
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ session: { type: "realtime", model: "gpt-realtime-2.1-mini" } }), signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`TTS secret HTTP ${response.status}`);
    const { value } = await response.json();
    const chunks = [];
    await new Promise((resolve, reject) => {
      const ws = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1-mini", ["realtime", `openai-insecure-api-key.${value}`]);
      const timer = setTimeout(() => finish(new Error("TTS timeout")), 45_000);
      function finish(error) { clearTimeout(timer); ws.close(); error ? reject(error) : resolve(); }
      ws.onopen = () => ws.send(JSON.stringify({ type: "response.create", response: { output_modalities: ["audio"], instructions: `Read exactly this text without adding anything: ${text}` } }));
      ws.onmessage = ({ data }) => {
        const event = JSON.parse(data);
        if (event.type === "response.output_audio.delta") chunks.push(Buffer.from(event.delta, "base64"));
        if (event.type === "error") finish(new Error("TTS API error"));
        if (event.type === "response.done") finish(event.response?.status === "failed" ? new Error("TTS failed") : undefined);
      };
      ws.onerror = () => finish(new Error("TTS connection failed"));
    });
    const audio = Buffer.concat(chunks);
    if (!audio.length) throw new Error("TTS empty");
    await writeFile(`${root}/${name}.pcm`, audio);
    await writeFile(`${root}/${name}.txt`, text);
    console.log(`AI-generated sample ${name}: ${audio.length} bytes`);
  }
  let used = false;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const server = createServer(async (req, res) => {
    if (req.headers.origin !== "http://127.0.0.1:4179") { res.writeHead(403).end(); return; }
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sandevistan-verifier");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
    if (req.headers["x-sandevistan-verifier"] !== "memory-only") { res.writeHead(403).end(); return; }
    if (req.url === "/key" && !used) { used = true; res.end(JSON.stringify({ key })); return; }
    let body = "";
    for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) { res.writeHead(413).end(); return; } }
    try {
      const value = JSON.parse(body);
      if (req.url === "/capture" && /^[a-z0-9-]+$/.test(value.label)) {
        const image = await fetch("http://127.0.0.1:9898/api/screenshot/glasses", { signal: AbortSignal.timeout(5_000) });
        await writeFile(`${root}/${value.label}.png`, Buffer.from(await image.arrayBuffer()));
        await writeFile(`${root}/${value.label}.json`, JSON.stringify(value, null, 2).split(key).join("[REDACTED]"));
        console.log(`Captured ${value.label}`);
      } else if (req.url === "/result") {
        await writeFile(`${root}/result.json`, JSON.stringify(value, null, 2).split(key).join("[REDACTED]"));
        console.log(JSON.stringify({ ok: value.ok, checks: value.checks, error: value.error }));
        finish();
      } else { res.writeHead(404).end(); return; }
      res.end('{"ok":true}');
    } catch { res.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(9899, "127.0.0.1", resolve));
  console.log("Assistant one-shot relay ready");
  const timer = setTimeout(finish, 600_000);
  await done;
  clearTimeout(timer);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
} catch (error) {
  console.log(String(error?.message ?? "Verification failed").split(key).join("[REDACTED]"));
} finally { key = undefined; }
