# Develop and package Sandevistan

Use Node.js `22.12+` on the `22.x` line. The verified version is `22.23.2`.
Use npm with the committed lockfile.
Physical-device checks require the Even app and a phone-accessible local network.

## Start the local preview

1. Install the locked dependencies.

   ```bash
   npm ci
   ```

2. Start the development server.

   ```bash
   npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
   ```

3. Open `/hud-canvas-fast` for the browser preview.
4. For glasses output, open this address through the Even app's Scan QR function.

   ```text
   http://<PHONE-REACHABLE-IP>:4176/hud-canvas-fast?sdk=0.0.16&build=<BUILD-ID>
   ```

A normal browser renders the preview. Only the Even app bridge sends images to the glasses.
Close the current Even Hub WebView before you open a diagnostic route.
Do not run overlapping image sessions.

## Optional routing fallback

Use a server environment variable only for a local fallback.
The phone's device-local user key remains the preferred path.

```bash
ORS_API_KEY='<server-only-key>' npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

Never place a real key in a command that you publish, a `VITE_` variable or a committed file.

## Verification commands

Run checks sequentially.

| Command | Result |
| --- | --- |
| `npm test` | App unit tests |
| `npm run test:server` | Node API, server and packaging checks |
| `npm run test:repo` | Repository copy and source-size checks |
| `npm run typecheck` | App TypeScript check |
| `npm run typecheck:simulator` | Simulator-fixture TypeScript check |
| `npm run build` | Web client and Sites Worker output |
| `npm run test:sites` | Build and Sites API tests |
| `npm run build:api` | Public API Worker bundle |
| `npm run verify:rss-live` | Sequential live RSS checks |
| `npm run check:evenhub-network` | Origin audit of the current built client |
| `npm run pack` | Fresh Even Hub build, origin audit and official package |
| `npm run release:check` | Mandatory combined pre-upload gate |

Before any upload, complete the [release checklist](../releases/pre-deployment-checklist.md).
An origin-audit failure stops `npm run pack` before official packaging.
Fix the manifest or remove an unused network dependency. Do not bypass the check.

The package is `sandevistan.ehpk`. Record its SHA-256 and size after the final build.
After any client, environment or manifest change, build and check the package again.
The npm package is private. Even Hub review and publication are separate portal actions.

## Device diagnostics

The default transport uses four in-flight tile calls.
Use this query only for the serial, original-palette comparison.

```text
http://<PHONE-REACHABLE-IP>:4176/hud-canvas-fast?sdk=0.0.16&pipeline=1&levels=original&build=<BUILD-ID>
```

The `qr`, `qr:hide-black` and `qr:rollback` convenience scripts contain a maintainer-specific preview address on port `4179`.
Replace that address for another phone or network. Match the port to your running server.

| Route | Historical diagnostic purpose |
| --- | --- |
| `/hud-canvas` | Original four-tile Canvas baseline |
| `/hud-hybrid` | Canvas and native Text comparison |
| `/hud-hybrid-z` | Explicit Text z-order comparison |
| `/calibration-max` | 576×288 boundary check |
| `/diagnostic-v10` | Tap-to-send 1-bit BMP check |

See [SDK compatibility](../reference/compatibility.md) before comparing old hardware results.

## Source layout

| Path | Contents |
| --- | --- |
| `src/` | Phone UI, Canvas renderers, transport and app state |
| `server/` | API handlers and provider adapters |
| `worker/api.js` | Packaged-build public API Worker |
| `worker/index.js` | Sites Worker |
| `tests/` | Node tests and simulator fixtures |
| `scripts/` | Build, package and verification commands |
| `app.json` | Even Hub manifest and permissions |
| `docs/` | Current guides and dated records |

## Contribution rules

1. Work on `main`, as required by the owner.
2. Preserve the 576×288 frame and four 288×144 tiles.
3. Keep image calls bounded. Do not add an encoded-image refresh queue.
4. Preserve device-local keys and server-only development fallbacks.
5. Never commit keys, private transcripts or personal evidence captures.
6. Keep tracked Markdown in English.
7. Run the checks that apply to the change.
8. Before an upload, complete every applicable release-checklist item.
9. Obtain approval of final external publication copy.

Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs` and `tests/sites-worker.test.mjs` available for Sites builds.
