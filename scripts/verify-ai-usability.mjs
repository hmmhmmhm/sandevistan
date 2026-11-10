import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const simulator = createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);
const root = 'output/ask-ai-usability-2026-11-08';
await mkdir(root, { recursive: true });
const delay = ms => new Promise(r => setTimeout(r, ms));
const api = 'http://127.0.0.1:9898/api';
const cases = [];
for (const mode of ['blocked', 'answer', 'stall']) {
  assert.throws(() => execFileSync('pgrep', ['-x', 'evenhub-simulator'], { stdio: 'pipe' }), 'Only one simulator may run');
  const process = spawn(simulator, [`http://127.0.0.1:4179/tests/simulator/ai-usability.html?mode=${mode}`, '--automation-port', '9898'], { stdio: 'ignore' });
  let consoleData;
  let readySaved = false, inputSent = false, answerSaved = false;
  const exited = new Promise(resolve => process.once('exit', resolve));
  try {
    const started = Date.now();
    while (Date.now() - started < 45_000) {
      try { consoleData = await fetch(api + '/console').then(r => r.json()); } catch { await delay(50); continue; }
      const events = (consoleData.entries ?? []).filter(e => e.message.startsWith('AI_UX ')).map(e => JSON.parse(e.message.slice(6)));
      const committed = events.filter(e => e.event === 'DISPLAY_COMMITTED');
      async function capture(name) {
        const bytes = await fetch(api + '/screenshot/glasses').then(r => r.arrayBuffer());
        await writeFile(`${root}/${mode}-${name}.png`, Buffer.from(bytes));
      }
      if (!readySaved && committed.some(e => e.phase === 'listening' && !e.text)) {
        await capture('ready'); readySaved = true;
      }
      if (mode === 'blocked' && !inputSent && events.some(e => e.event === 'IMAGE_BLOCKED')) {
        await fetch(api + '/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'double_click' }) });
        inputSent = true;
      }
      if (mode === 'blocked' && committed.some(e => e.view === 'dashboard')) {
        await capture('exit');
        const block = events.find(e => e.event === 'IMAGE_BLOCKED');
        const exit = events.find(e => e.event === 'EXIT_LOGICAL');
        const close = events.find(e => e.event === 'MIC_CLOSE');
        assert.ok(exit.ms - block.ms < 1000, 'Exit must happen before delayed image completes');
        assert.ok(close.ms - exit.ms < 100, 'Session microphone closes immediately');
        assert.ok(events.every(e => e.maxImages <= 4));
        cases.push({ mode, passed: true, blockedToExitMs: exit.ms - block.ms, exitToMicCloseMs: close.ms - exit.ms });
        break;
      }
      if (mode === 'answer' && !answerSaved && committed.some(e => e.text.length > 30)) { await capture('answer'); answerSaved = true; }
      if (mode === 'answer' && answerSaved && committed.some(e => e.phase === 'listening' && e.text.length > 30)) {
        const batches = events.filter(e => e.event === 'TEXT_BATCH' && e.text);
        assert.equal(batches.length, 1);
        cases.push({ mode, passed: true, firstBatchCharacters: [...batches[0].text].length, batches: batches.length });
        break;
      }
      if (mode === 'stall' && committed.some(e => e.phase === 'error')) {
        await capture('timeout');
        assert.ok(events.some(e => e.event === 'MIC_CLOSE'));
        assert.ok(events.some(e => e.event === 'SOCKET_CLOSED'));
        cases.push({ mode, passed: true, cleanedUp: true });
        break;
      }
      await delay(30);
    }
    assert.equal(cases.at(-1)?.mode, mode, `${mode} did not finish`);
    await writeFile(`${root}/${mode}-console.json`, JSON.stringify(consoleData, null, 2));
    console.log(JSON.stringify(cases.at(-1)));
  } finally {
    process.kill('SIGTERM');
    await exited;
    let gone = false;
    for (let i = 0; i < 40; i++) {
      try { execFileSync('pgrep', ['-x', 'evenhub-simulator'], { stdio: 'pipe' }); }
      catch { gone = true; break; }
      await delay(50);
    }
    assert.ok(gone, 'Simulator must exit before the next case');
  }
}
await writeFile(`${root}/result.json`, JSON.stringify({ passed: true, syntheticProtocol: true, realSdkTransport: true, cases }, null, 2));
