import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";

// Read the key from stdin only; never persist it or print upstream error messages.
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let key;
for await (const line of lines) {
  if (!key) { key = line.trim(); console.log("Credential loaded in memory"); continue; }
  if (line === "exit") break;
  try {
    if (line !== "models") {
      const { runLiveCommand } = await import(`./live-ai-commands.mjs?run=${Date.now()}`);
      await runLiveCommand(line, key);
      continue;
    }
    if (line === "models") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000),
      });
      const value = await response.json();
      if (!response.ok) {
        console.log(JSON.stringify({ status: response.status, code: value.error?.code ?? "unknown" }));
        continue;
      }
      const models = value.data.map(({ id, created }) => ({ id, created }));
      await mkdir("output/simulator-audit-2026-11-08", { recursive: true });
      await writeFile("output/simulator-audit-2026-11-08/account-models.json", JSON.stringify(models, null, 2));
      console.log(JSON.stringify(models.filter(({ id }) => /^gpt-(?:6|realtime|live|transcribe)/.test(id))));
    }
  } catch (error) {
    console.log(JSON.stringify({ error: error instanceof Error ? error.name : "UnknownError" }));
  }
}
key = undefined;
lines.close();
process.stdin.pause();
