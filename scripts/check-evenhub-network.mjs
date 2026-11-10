import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import ts from "typescript";

// These are XML identifiers in SVG/MathML markup, never network destinations.
const XML_NAMESPACES = /http:\/\/www\.w3\.org\/(?:2000\/svg|1998\/Math\/MathML|1999\/xlink|XML\/1998\/namespace)(?=$|[\s"'<>])/gu;
const URL_AUTHORITY = /\b(?:https?|wss?):\/\/[^\s/"'`<>{}\\]+/giu;

export function embeddedOrigins(text, javascript = false) {
  const origins = new Set();
  function inspect(value) {
    for (const match of value.replace(XML_NAMESPACES, "").matchAll(URL_AUTHORITY)) {
      origins.add(new URL(match[0]).origin);
    }
  }
  if (javascript) {
    const source = ts.createSourceFile("bundle.js", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (source.parseDiagnostics.length) throw Error("Cannot parse bundled JavaScript");
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) inspect(node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  } else inspect(text);
  return [...origins].sort();
}

function bundleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return bundleFiles(file);
    if (entry.isSymbolicLink()) throw Error("Symlinks are not accepted in the packaged client: " + file);
    return /\.(?:js|mjs|css|html)$/u.test(file) ? [file] : [];
  });
}

export function checkEvenHubNetwork({ manifest, directory }) {
  if (!existsSync(path.join(directory, manifest.entrypoint ?? "index.html"))) throw Error("Missing client entrypoint; build the Even Hub client first");
  const network = manifest.permissions?.filter(permission => permission.name === "network");
  if (network?.length !== 1 || !Array.isArray(network[0].whitelist)) throw Error("Exactly one network permission with a whitelist is required");
  const whitelist = network[0].whitelist;
  const invalid = whitelist.filter((entry, index) => {
    if (typeof entry !== "string") return true;
    try {
      const url = new URL(entry);
      return !["https:", "wss:"].includes(url.protocol) || url.origin !== entry || entry.includes("*") || whitelist.indexOf(entry) !== index;
    } catch { return true; }
  });
  const files = bundleFiles(directory);
  if (!files.some(file => /\.(?:js|mjs)$/u.test(file))) throw Error("No bundled JavaScript found; refusing an empty audit");
  const references = files.flatMap(file => embeddedOrigins(readFileSync(file, "utf8"), /\.(?:js|mjs)$/u.test(file)).map(origin => ({ origin, file: path.relative(directory, file) })));
  const origins = [...new Set(references.map(item => item.origin))].sort();
  const missing = origins.filter(origin => !whitelist.includes(origin));
  return { ok: invalid.length === 0 && missing.length === 0, version: manifest.version, files: files.length, origins, missing, invalid, references };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { manifest: { type: "string", default: "app.json" }, dir: { type: "string", default: "dist/client" }, report: { type: "string" } } });
    const result = checkEvenHubNetwork({ manifest: JSON.parse(readFileSync(values.manifest, "utf8")), directory: values.dir });
    if (values.report) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(values.report, JSON.stringify(result, null, 2) + "\n");
    }
    if (!result.ok) {
      console.error("Even Hub network audit FAILED. Missing origins:", result.missing.join(", ") || "none");
      console.error("Invalid or duplicate whitelist entries:", JSON.stringify(result.invalid));
      process.exitCode = 1;
    } else console.log(`Even Hub network audit passed: ${result.origins.length} origins across ${result.files} client files (v${result.version}).`);
  } catch (error) {
    console.error("Even Hub network audit FAILED:", error.message);
    process.exitCode = 1;
  }
}
