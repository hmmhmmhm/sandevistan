import { createInterface } from 'node:readline';
import { createServer as httpServer } from 'node:http';
import { createServer as viteServer } from 'vite';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, access, copyFile } from 'node:fs/promises';
import { selectOpenAiModels } from '../server/openai-auth.js';

const weather = process.argv.includes('--ask-weather');
const followup = weather || process.argv.includes('--ask-followup');
const history = process.argv.includes('--conversate-history');
const conversate = history || process.argv.includes('--conversate');
const exitOnly = process.argv.includes('--hold-exit');
const hold = followup || exitOnly || process.argv.includes('--hold-asr');
const dual = hold || process.argv.includes('--dual-asr');
const comparison = process.argv.includes('--compare-asr');
const defaultRoot = weather ? 'output/ask-ai-weather-2026-11-08' : followup ? 'output/ask-ai-followup-2026-11-08' : history ? 'output/conversate-history-live-2026-11-08' : exitOnly ? 'output/ask-ai-hold-exit-2026-11-08' : hold ? 'output/ask-ai-hold-2026-11-08' : dual ? 'output/ask-ai-dual-2026-11-08' : comparison ? 'output/ask-ai-asr-2026-11-08' : conversate ? 'output/conversate-live-2026-11-08' : 'output/ask-ai-live-2026-11-08';
const outputArgument = process.argv.find(value => value.startsWith('--output-dir='))?.slice('--output-dir='.length);
if (outputArgument && !/^output\/[a-zA-Z0-9/_-]+$/.test(outputArgument)) throw Error('Invalid verification output directory');
const root = outputArgument ?? defaultRoot;
const samples = weather ? [['short','same calculation'],['weather','오늘 경기도 안산 날씨를 알려주세요. 현재 기온과 비가 오는지도 확인해 주세요.'],['umbrella','그럼 거기 오늘 외출할 때 우산이 필요할까요?']] : followup ? [['short', 'same calculation'], ['english', 'same English schedule']] : exitOnly ? [['exit', 'same long answer']] : dual ? [['short', 'same calculation'], ['english', 'same English'], ['mixed', 'same mixed-language'], ['exit', 'same long answer']] : comparison ? [
  ['default-english', 'same English audio'], ['live-english', 'same English audio'],
  ['default-mixed', 'same mixed-language audio'], ['live-mixed', 'same mixed-language audio'], ['metadata', 'same calculation audio'],
] : conversate ? [
  ['schedule', 'Could we schedule the launch review for next Tuesday at three? Please send the budget before the meeting.'],
  ['term', 'Our net revenue retention is one hundred and ten percent. What does net revenue retention mean?'],
  ['revision', 'Actually, the launch review is Thursday at ten, and the budget is due Wednesday evening.'],
  ['mixed', '그럼 다음 주 목요일 오전 열 시에 회의하고, net revenue retention 목표는 백십 퍼센트로 정리하겠습니다.'],
] : [
  ['short', '일 더하기 일은 얼마인가요? 숫자만 답해 주세요.'],
  ['explain', '하늘이 파랗게 보이는 이유를 세 문장으로 설명해 주세요.'],
  ['exit', '태양광 발전의 장점 열 가지와 단점 열 가지를 번호를 붙여 각각 자세히 설명해 주세요.'],
];
const lines = createInterface({ input: process.stdin });
let key;
for await (const line of lines) { key = line.trim(); break; }
lines.close(); process.stdin.pause();
if (!key) throw Error('Credential required on stdin');
const redact = value => JSON.stringify(value, null, 2).split(key).join('[REDACTED]');
const delay = ms => new Promise(r => setTimeout(r, ms));
let vite, relay, simulator;
let finish;
const done = new Promise(resolve => { finish = resolve; });
let timeout;
let outcome;
try {
  await mkdir(root, { recursive: true });
  const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error(`OpenAI catalog HTTP ${response.status}`);
  const ids = (await response.json()).data.map(value => value.id);
  const selected = selectOpenAiModels(ids);
  const ttsModel = ids.includes('gpt-realtime-2.1-mini') ? 'gpt-realtime-2.1-mini' : selected.realtime;
  console.log(JSON.stringify({ selected, ttsModel }));
  if (history) {
    for (const [name] of samples) await copyFile(`output/conversate-live-2026-11-08/${name}.pcm`, `${root}/${name}.pcm`);
  }
  if (dual) {
    for (const [name] of samples.filter(([name]) => !["weather","umbrella"].includes(name))) await copyFile(name === 'english' ? 'output/conversate-live-2026-11-08/schedule.pcm'
      : name === 'mixed' ? 'output/conversate-live-2026-11-08/mixed.pcm' : `output/ask-ai-live-2026-11-08/${name}.pcm`, `${root}/${name}.pcm`);
  }
  if (comparison) {
    for (const [name] of samples) {
      const source = name === 'metadata' ? 'output/ask-ai-live-2026-11-08/short.pcm'
        : `output/conversate-live-2026-11-08/${name.endsWith('english') ? 'schedule' : 'mixed'}.pcm`;
      await copyFile(source, `${root}/${name}.pcm`);
    }
  }
  for (const [name, text] of samples) {
    if (history || dual || comparison || process.argv.includes('--reuse-tts')) {
      try { await access(`${root}/${name}.pcm`); console.log(`Reusing this task's generated TTS: ${name}`); continue; } catch {}
    }
    const minted = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { type: 'realtime', model: ttsModel } }), signal: AbortSignal.timeout(15_000),
    });
    if (!minted.ok) throw Error(`TTS secret HTTP ${minted.status}`);
    const secret = (await minted.json()).value;
    const chunks = [];
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${ttsModel}`, ['realtime', `openai-insecure-api-key.${secret}`]);
      const timer = setTimeout(() => end(Error('TTS timeout')), 60_000);
      function end(error) { clearTimeout(timer); ws.close(); error ? reject(error) : resolve(); }
      ws.onopen = () => ws.send(JSON.stringify({ type: 'response.create', response: {
        output_modalities: ['audio'], instructions: `Read exactly this text in its original languages, without answering it or adding words: ${text}`,
      } }));
      ws.onmessage = ({ data }) => {
        const event = JSON.parse(data);
        if (event.type === 'response.output_audio.delta') chunks.push(Buffer.from(event.delta, 'base64'));
        if (event.type === 'error') end(Error(`TTS API ${String(event.error?.code ?? 'error').replace(/[^a-z0-9_-]/gi, '')}`));
        if (event.type === 'response.done') end(event.response?.status === 'completed' ? undefined : Error('TTS incomplete'));
      };
      ws.onerror = () => end(Error('TTS connection failed'));
    });
    const audio = Buffer.concat(chunks);
    if (!audio.length) throw Error('Empty TTS');
    await writeFile(`${root}/${name}.pcm`, audio);
    await writeFile(`${root}/${name}.txt`, text);
    console.log(JSON.stringify({ generatedTts: name, seconds: audio.length / 48000 }));
  }
  if (process.argv.includes('--inspect-tts')) {
    const reference = [];
    for (const [name] of samples) {
      const { readFile } = await import('node:fs/promises');
      const pcm = await readFile(`${root}/${name}.pcm`);
      const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8);
      header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
      header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
      header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
      const form = new FormData(); form.append('model', selected.refinement);
      form.append('file', new Blob([header, pcm], { type: 'audio/wav' }), name + '.wav');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw Error(`Reference transcription HTTP ${response.status}`);
      reference.push({ name, text: (await response.json()).text });
    }
    await writeFile(`${root}/reference-transcription.json`, redact(reference));
    console.log(redact(reference)); outcome = { ok: true };
  }
  if (!outcome) {
  let used = false;
  relay = httpServer(async (req, res) => {
    if (req.headers.origin !== 'http://127.0.0.1:4179') { res.writeHead(403).end(); return; }
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-sandevistan-verifier');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
    if (req.headers['x-sandevistan-verifier'] !== 'memory-only') { res.writeHead(403).end(); return; }
    if (req.url === '/key' && !used) { used = true; res.end(JSON.stringify({ key })); return; }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) { res.writeHead(413).end(); return; } }
    try {
      const value = JSON.parse(body);
      if (req.url === '/capture' && /^[a-z0-9-]+$/.test(value.label)) {
        const png = await fetch('http://127.0.0.1:9898/api/screenshot/glasses').then(r => r.arrayBuffer());
        await writeFile(`${root}/${value.label}.png`, Buffer.from(png));
        if (typeof value.canvasPng === 'string' && value.canvasPng.startsWith('data:image/png;base64,')) {
          await writeFile(`${root}/${value.label}-canvas.png`, Buffer.from(value.canvasPng.split(',')[1], 'base64'));
          delete value.canvasPng;
        }
        await writeFile(`${root}/${value.label}.json`, redact(value));
      } else if (req.url === '/result') {
        outcome = value; await writeFile(`${root}/result.json`, redact(value)); finish();
      } else { res.writeHead(404).end(); return; }
      res.end('{"ok":true}');
    } catch { res.writeHead(500).end(); }
  });
  await new Promise(resolve => relay.listen(9899, '127.0.0.1', resolve));
  vite = await viteServer({ server: { host: '127.0.0.1', port: 4179, strictPort: true } });
  await vite.listen();
  try { execFileSync('pgrep', ['-x', 'evenhub-simulator'], { stdio: 'pipe' }); throw Error('Existing simulator must be stopped first'); }
  catch (error) { if (!('status' in error)) throw error; }
  const binary = createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);
  simulator = spawn(binary, [`http://127.0.0.1:4179/tests/simulator/${conversate ? 'conversate-live' : 'ask-ai-live'}.html${weather ? '?weather=1' : followup ? '?followup=1' : history ? '?history=1' : exitOnly ? '?hold=1&exitOnly=1' : hold ? '?hold=1' : dual ? '?dual=1' : comparison ? '?compare=1' : ''}`, '--automation-port', '9898'], { stdio: 'ignore' });
  timeout = setTimeout(() => { outcome = { ok: false, error: 'Verifier deadline' }; finish(); }, 420_000);
  let exitSent = false;
  const holdActions = new Set();
  let stopped = false;
  void done.then(() => { stopped = true; });
  while (!stopped) {
    try {
      const log = await fetch('http://127.0.0.1:9898/api/console').then(r => r.json());
      for (const entry of log.entries) {
        const message = entry.message;
        const burst=message.match(/^LIVE_SCROLL_REQUEST (up|down):(\d+)$/);
        if(weather && burst && !holdActions.has(message)) {
          holdActions.add(message);
          for(let i=0;i<Number(burst[2]);i++) await fetch('http://127.0.0.1:9898/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:burst[1]})});
        }
        const historyAction = message.match(/^CONVERSATE_ACTION_REQUEST \d+:(click|up|down)$/)?.[1];
        const action = historyAction ?? (message.startsWith('LIVE_READY_TO_HOLD ') ? 'long_press'
          : message.startsWith('LIVE_READY_TO_RELEASE ') ? 'long_press_release' : undefined);
        if ((hold || history) && action && !holdActions.has(message)) {
          holdActions.add(message);
          await fetch('http://127.0.0.1:9898/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        }
      }
      if (!conversate && !exitSent && log.entries.some(e => e.message.startsWith('LIVE_READY_TO_EXIT'))) {
        exitSent = true;
        await fetch('http://127.0.0.1:9898/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'double_click' }) });
        console.log('Sent real simulator double-tap during live generation');
      }
    } catch {}
    await delay(30);
  }
  await writeFile(`${root}/console.json`, redact(await fetch('http://127.0.0.1:9898/api/console').then(r => r.json())));
  console.log(redact({ ok: outcome?.ok, checks: outcome?.checks, error: outcome?.error }));
  }
} catch (error) {
  outcome = { ok: false, error: String(error?.message ?? 'Verification failed') };
  console.log(redact(outcome));
  await mkdir(root, { recursive: true });
  await writeFile(`${root}/harness-failure.json`, redact(outcome));
} finally {
  clearTimeout(timeout);
  if (simulator && simulator.exitCode === null) {
    const exited = new Promise(resolve => simulator.once('exit', resolve));
    simulator.kill('SIGTERM'); await exited;
  }
  if (relay) { relay.closeAllConnections(); await new Promise(resolve => relay.close(resolve)); }
  await vite?.close();
  key = undefined;
}
if (!outcome?.ok) process.exitCode = 1;
