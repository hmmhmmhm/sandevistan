import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { embeddedOrigins, checkEvenHubNetwork } from "../scripts/check-evenhub-network.mjs";

function fixture(t, text, whitelist) {
  const directory = mkdtempSync(path.join(tmpdir(), "evenhub-network-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "assets"));
  writeFileSync(path.join(directory, "index.html"), '<script src="assets/app.js"></script>');
  writeFileSync(path.join(directory, "assets/app.js"), text);
  const manifest = { version: "test", entrypoint: "index.html", permissions: [{ name: "network", whitelist }] };
  return { directory, manifest };
}

test("finds every reviewer-reported URL in real JS literals, including escaped slashes", t => {
  const urls = ["https://www.lemonde.fr/en/international/rss_full.xml", "https://feeds.bbci.co.uk/news/world/rss.xml", "https://platform.openai.com/api-keys"];
  const input = fixture(t, 'const urls=' + JSON.stringify(urls).replaceAll("/", "\\/") + ';', []);
  const result = checkEvenHubNetwork(input);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["https://feeds.bbci.co.uk", "https://platform.openai.com", "https://www.lemonde.fr"]);
  input.manifest.permissions[0].whitelist = result.missing;
  assert.equal(checkEvenHubNetwork(input).ok, true);
});

test("checks template heads, nested assets, HTML links and CSS URLs", t => {
  const input = fixture(t, 'const url=`wss://speech.example.com/session?model=${model}`;', ["wss://speech.example.com"]);
  writeFileSync(path.join(input.directory, "index.html"), '<a href="https://keys.example.com/new">Key</a>');
  writeFileSync(path.join(input.directory, "assets/style.css"), 'a{background:url("https://images.example.com/device.png")}');
  assert.deepEqual(checkEvenHubNetwork(input).missing, ["https://images.example.com", "https://keys.example.com"]);
});

test("an approved host does not grant an undeclared subdomain or protocol", t => {
  const input = fixture(t, 'fetch("https://other.example.com/x");new WebSocket("wss://api.example.com/x");', ["https://api.example.com"]);
  assert.deepEqual(checkEvenHubNetwork(input).missing, ["https://other.example.com", "wss://api.example.com"]);
});

test("ignores exact SVG/MathML namespaces, but checks other W3C URLs", () => {
  assert.deepEqual(embeddedOrigins('const svg=\'<svg xmlns="http://www.w3.org/2000/svg">\';const docs="https://www.w3.org/docs";', true), ["https://www.w3.org"]);
});

test("rejects invalid, insecure, wildcard, duplicate and path-bearing entries", t => {
  const entries = ["http://localhost:4179", "https://*.example.com", "https://api.example.com/path", "https://api.example.com", "https://api.example.com"];
  const result = checkEvenHubNetwork(fixture(t, 'const n=1;', entries));
  assert.equal(result.ok, false);
  assert.equal(result.invalid.length, 4);
});

test("refuses missing builds and unparseable JS rather than passing an empty check", t => {
  const input = fixture(t, 'const broken = ;', []);
  assert.throws(() => checkEvenHubNetwork(input), /Cannot parse/);
  rmSync(path.join(input.directory, "index.html"));
  assert.throws(() => checkEvenHubNetwork(input), /Missing client entrypoint/);
});

test("refuses a client without bundled JavaScript or network permission", t => {
  const input = fixture(t, '', []);
  rmSync(path.join(input.directory, "assets/app.js"));
  assert.throws(() => checkEvenHubNetwork(input), /No bundled JavaScript/);
  input.manifest.permissions = [];
  assert.throws(() => checkEvenHubNetwork(input), /Exactly one network/);
});

test("CLI exits nonzero and names the undeclared origin", t => {
  const input = fixture(t, 'fetch("https://new.example.com/feed");', []);
  const manifestPath = path.join(input.directory, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(input.manifest));
  const run = spawnSync(process.execPath, ["scripts/check-evenhub-network.mjs", "--manifest", manifestPath, "--dir", input.directory], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /https:\/\/new.example.com/);
});

test("the actual pack command audits the built client before official packaging", () => {
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(scripts.pack, /npm run build:evenhub && npm run check:evenhub-network && evenhub pack/);
});


test("does not exempt namespace URLs with query, fragment or suffix", () => {
  for (const suffix of ["?fetch=1", "#resource", ".png", "/resource"]) {
    assert.deepEqual(embeddedOrigins(JSON.stringify("http://www.w3.org/2000/svg" + suffix), true), ["http://www.w3.org"]);
  }
});

test("checks uppercase schemes and normalizes the parsed origin", () => {
  assert.deepEqual(embeddedOrigins('fetch("HTTPS://API.EXAMPLE.COM/path")', true), ["https://api.example.com"]);
});
