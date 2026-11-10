# Sandevistan Rebrand and English Documentation Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Rename the project from `even-relic` and `RELIC` to `sandevistan` and `SANDEVISTAN`.
Publish an English-facing repository and translate every Markdown document into English.
Do not delete or consolidate the historical implementation record.

The GitHub repository will become `hmmhmmhm/sandevistan`. The existing
`0.0.12-reproduce` branch must remain available and unchanged so Even
Realities can continue to inspect the SDK 0.0.12 `sendFailed` reproduction.

## Starting Point and Branch Policy

`main` is fast-forwarded to accepted hardware checkpoint `10a068b` before the
rebrand begins. All rebrand, translation, README, licensing, and repository
verification changes are committed only to `main`.

The following branches are not merged or rewritten:

- `0.0.12-reproduce`
- `feature/g2-ors-routing`
- local experimental branches

Renaming the GitHub repository changes the enclosing repository URL but does
not modify branch contents or commit IDs. The reproduction branch will be
verified after the rename.

## Canonical Naming

Current product identifiers are replaced according to this mapping:

| Current | New |
| --- | --- |
| `even-relic` | `sandevistan` |
| `RELIC` / `Relic` | `SANDEVISTAN` / `Sandevistan` |
| `com.hmmhmmhm.evenrelic` | `com.hmmhmmhm.sandevistan` |
| `even-relic.ehpk` | `sandevistan.ehpk` |
| `relic:*` storage namespace | `sandevistan:*` |
| `relicTL`, `relicTR`, `relicBL`, `relicBR` | `sandevistanTL`, `sandevistanTR`, `sandevistanBL`, `sandevistanBR` |
| `docs/plans/2026-07-25-relic-hud-prototype.md` | `docs/plans/2026-07-25-sandevistan-hud-prototype.md` |

The npm package is an application workspace, not a publishable library.
`package.json` must contain `"private": true`. No npm publication workflow,
registry metadata, or release command is added.

The application has not been distributed through Even Hub, so no package ID,
storage key, or installed-state migration is required.

## Product Copy Scope

The brand shown by the app, browser preview, Canvas HUD, hybrid HUD, diagnostic
surfaces, accessibility names, tests, and package metadata becomes
Sandevistan.

Korean product content remains in place:

- Korean weather descriptions;
- Korean news and RSS content;
- Korean navigation instructions and destination text;
- Korean phone-side status, control, and error messages.

Those strings are runtime product behavior, not repository documentation.
Changing them would alter the hardware-tested layout and is outside this
rebrand.

## Historical Identifier Policy

Narrative references that incorrectly use Sandevistan as the project name are
rewritten as Sandevistan.

Preserve exact historical evidence.
If a quoted payload, filename, container name, log, commit message, URL, or branch state used `relicTL`, `relicTR`, or another old identifier, retain it.
Describe such names as legacy identifiers.
Translate the surrounding Korean prose into English.

The SDK 0.0.12 reproduction branch remains the authoritative byte-for-byte
record of that failure. Its files are not translated or rebranded.

## English Documentation

Every tracked Markdown file on `main` is translated to English. No file is
deleted, summarized, or moved merely to avoid translation. Structure is
preserved:

- headings and section hierarchy;
- tables;
- numbered and unordered lists;
- task checkboxes and completion state;
- code fences and commands;
- commit hashes, dates, measurements, and hardware results;
- relative links and source paths.

Translation quality requirements:

- natural technical English rather than word-for-word Korean syntax;
- consistent terms for user, device, glasses, ring, bridge, tile, refresh,
  navigation, and reproduction;
- concise active voice;
- no invented test result or hardware observation;
- no unresolved placeholder;
- zero Hangul code points in tracked Markdown on `main`.

The translation includes:

- `README.md`;
- `AGENTS.md`;
- `design-qa.md`;
- `docs/design`;
- `docs/hardware`;
- `docs/plans`;
- `docs/research`;
- every `docs/superpowers/plans` document;
- every `docs/superpowers/specs` document, including this design and the
  implementation plan created from it.

## README

`README.md` becomes a polished English project landing page with:

1. `Sandevistan` title and a concise product statement.
2. Shields.io badges for:
   - TypeScript;
   - React;
   - Vite;
   - Even Hub SDK 0.0.11;
   - physical G2 validation;
   - test status;
   - MIT license.
3. The existing project-owned HUD preview image.
4. A compact table of contents.
5. Overview and design principles.
6. Feature list and four-page information architecture.
7. G2 and R1 interaction reference.
8. Raster transport architecture and no-queue behavior.
9. Keyless location, weather, OSM, and RSS data sources.
10. Optional OpenRouteService routing configuration.
11. Local development, QR, build, test, and packaging commands.
12. Repository structure.
13. Hardware compatibility and the SDK 0.0.12 reproduction branch.
14. Privacy, data-source attribution, and operational limitations.
15. Contributing guidance.
16. MIT license.
17. A clear unofficial fan-project and trademark disclaimer for Cyberpunk
    2077, CD PROJEKT RED, Even Realities, and their respective owners.

Badges must not claim a CI workflow or deployment that does not exist. Static
badges may report the exact verified test count and hardware checkpoint.

## License

Add a standard MIT `LICENSE` file for the source code with:

- year `2026`;
- copyright holder `hmmhmmhm`.

The README makes clear that the license covers this repository's source code,
not third-party trademarks, game concepts, data providers, or device SDKs.

## Repository Verification

Add a repository-copy checker that runs on Node.js without extra dependencies.
It must:

1. enumerate tracked Markdown files;
2. fail if a tracked Markdown file contains a Hangul code point;
3. fail if current package or app metadata still uses `even-relic`,
   `com.hmmhmmhm.evenrelic`, or a publishable npm package;
4. fail if current source branding still uses `RELIC` where Sandevistan is
   expected;
5. allow explicitly documented legacy identifiers only in historical evidence;
6. report file paths and line numbers for every violation.

Expose the checker as `npm run test:repo`. It complements rather than replaces
the application tests.

## Testing

All test commands run serially. Completion requires:

```bash
npm test
npm run test:repo
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 \
  tests/api-router.test.mjs \
  tests/map-api.test.mjs \
  tests/news-api.test.mjs \
  tests/route-api.test.mjs
git diff --check
```

Branding tests are updated before implementation so they fail on the old
identifiers and pass after the rename. Existing hardware transport behavior,
tile order, input direction, no-queue scheduling, storage semantics, and live
data behavior must remain unchanged.

## Commit and Repository Rename Sequence

Changes are committed to `main` in reviewable groups:

1. repository checks and application identifiers;
2. runtime Sandevistan branding;
3. README and license;
4. durable design, research, and hardware translations;
5. historical plan and specification translations;
6. final verification evidence.

After the clean final verification:

1. push `main` to `hmmhmmhm/even-relic`;
2. rename the public GitHub repository to `hmmhmmhm/sandevistan`;
3. update the shared `origin` URL;
4. verify the new repository URL and default branch;
5. verify `main`, `0.0.12-reproduce`, and `feature/g2-ors-routing` refs;
6. verify the old GitHub URL redirects;
7. restart the 4176 development server from the renamed `main` source;
8. confirm the Sandevistan test URL returns HTTP 200.

No force push, history rewrite, branch deletion, npm publication, or Even Hub
publication is performed.

## Completion Criteria

- GitHub repository name is `sandevistan`.
- Default branch `main` contains the latest accepted G2 product and rebrand.
- `0.0.12-reproduce` points to the same commit as before the rename.
- Package and app metadata use the canonical Sandevistan identifiers.
- npm publication is blocked by `"private": true`.
- The visible application and HUD use Sandevistan branding.
- Every tracked Markdown file on `main` is English and the language checker
  reports zero Hangul violations.
- README, badges, license, data attributions, and disclaimers are complete.
- All serial verification commands pass.
- The 4176 Sandevistan server returns HTTP 200.
