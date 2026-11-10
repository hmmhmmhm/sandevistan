import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { parseFencedCode } from "./markdown-code.mjs";

const { values } = parseArgs({ options: { base: { type: "string" }, report: { type: "string" } } });
const root = process.cwd();
if (values.base) execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${values.base}^{commit}`], { stdio: "ignore" });
let comparedFiles = 0;
let comparedCodeBlocks = 0;
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(file) : file.endsWith(".md") ? [file] : [];
  });
}
function withoutFences(text) { return parseFencedCode(text).prose; }

function slug(text) {
  return text.toLowerCase().replace(/<[^>]+>/gu, "").replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/gu, "-");
}
function headings(text) {
  const counts = new Map();
  return [...withoutFences(text).matchAll(/^#{1,6}\s+(.+)$/gmu)].map(match => {
    const base = slug(match[1]); const n = counts.get(base) ?? 0; counts.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  });
}
const files = ["README.md", ...filesIn("docs")];
const problems = [], localEvidence = [], longSentences = [], protectedChanges = [];
if (values.base) {
  const originalFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", values.base, "--", "docs"], { encoding: "utf8" }).trim().split("\n");
  for (const file of originalFiles.filter(file => file.endsWith(".md"))) {
    if (!files.includes(file)) protectedChanges.push({ file, reason: "Original document removed" });
  }
}
for (const file of files) {
  const original = readFileSync(file, "utf8"); const text = withoutFences(original);
  if (file === "README.md" && original.split("\n").length > 101) problems.push({ file, reason: "README exceeds 100 lines" });
  for (const match of text.matchAll(/\]\(([^\n]+?)\)/gu)) {
    let target = match[1].replace(/^<|>$/gu, "").split(/\s+["']/u)[0];
    if (/^(?:https?:|mailto:|data:)/iu.test(target)) continue;
    target = decodeURIComponent(target);
    const [pathname, fragment] = target.split("#");
    const resolved = path.resolve(path.dirname(file), pathname || path.basename(file));
    if (resolved === path.join(root, "output") || resolved.startsWith(path.join(root, "output") + path.sep)) { localEvidence.push({ file, target }); continue; }
    if (!existsSync(resolved)) { problems.push({ file, target, reason: "Missing local target" }); continue; }
    if (fragment && resolved.endsWith(".md") && statSync(resolved).isFile()) {
      const destination = readFileSync(resolved, "utf8");
      if (!headings(destination).includes(fragment) && !destination.includes(`id="${fragment}"`)) problems.push({ file, target, reason: "Missing heading anchor" });
    }
  }
  let paragraph = [];
  function inspect() {
    const joined = paragraph.join(" ").replace(/`[^`]+`/gu, "TERM").replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1");
    for (const sentence of joined.split(/(?<=[.!?])\s+/u)) {
      const words = sentence.trim().split(/\s+/u).filter(Boolean).length;
      if (words > 25) longSentences.push({ file, words, text: sentence.trim() });
    }
    paragraph = [];
  }
  for (const line of text.split("\n")) {
    if (!line.trim() || /^\s*(?:#|\||>|[-*]|\d+\.)/u.test(line)) inspect();
    else paragraph.push(line.trim());
  }
  inspect();
  if (values.base && file !== "README.md") {
    let before;
    try { before = execFileSync("git", ["show", `${values.base}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { continue; }
    comparedFiles += 1;
    const fences = parseFencedCode(before).blocks;
    comparedCodeBlocks += fences.length;
    const blockCounts = new Map();
    for (const block of parseFencedCode(original).blocks) blockCounts.set(block, (blockCounts.get(block) ?? 0) + 1);
    for (const block of fences) {
      const left = blockCounts.get(block) ?? 0;
      if (!left) protectedChanges.push({ file, reason: "Original fenced code changed or removed" });
      else blockCounts.set(block, left - 1);
    }
    const patterns = [
      ["inline code", /(?<!`)`[^`\n]+`(?!`)/gu],
      ["numeric token", /(?<!\w)\d+(?:\.\d+)*(?:%|ms|px|s)?/gu],
      ["heading", /^#{1,6} .*$/gmu],
      ["link target", /\]\(([^)]+)\)/gu],
    ];
    for (const [kind, pattern] of patterns) {
      const tally = new Map();
      for (const token of original.match(pattern) ?? []) tally.set(token, (tally.get(token) ?? 0) + 1);
      for (const token of before.match(pattern) ?? []) {
        const left = tally.get(token) ?? 0;
        if (!left) protectedChanges.push({ file, reason: `Missing original ${kind}`, token });
        else tally.set(token, left - 1);
      }
    }
  }
}
const report = { ok: problems.length === 0 && protectedChanges.length === 0, files: files.length, comparedFiles, comparedCodeBlocks, problems, protectedChanges, localEvidenceLinks: localEvidence.length, longSentenceReviewItems: longSentences, limits: "Local links and selected structural checks only. Paragraph word counts exclude lists, tables, quotes and code. They are review aids, not complete sentence or STE dictionary certification. External URLs and private evidence are not fetched." };
if (values.report) writeFileSync(values.report, JSON.stringify(report, null, 2) + "\n");
console.log(`Documentation check: ${files.length} files, ${problems.length} link/structure issues, ${protectedChanges.length} protected-code issues.`);
console.log(`Paragraph review: ${longSentences.length} items exceed 25 words. Lists, tables, quotes and code are excluded.`);
for (const item of [...problems, ...protectedChanges]) console.error(JSON.stringify(item));
if (!report.ok) process.exitCode = 1;
