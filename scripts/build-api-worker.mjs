import { build } from "esbuild";
await build({
  entryPoints: ["worker/api.js"],
  outfile: "dist/worker-api/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
});
