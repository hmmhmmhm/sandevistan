# Documentation

Use the current guides to operate or change the app.
Use dated records to inspect the evidence available at a past checkpoint.
A historical pass does not approve a later SDK or release.

## Current guides

| Guide | Contents |
| --- | --- |
| [Product guide](product/overview.md) | Phone settings, pages and gestures |
| [AI guide](product/ai.md) | Ask AI, Conversate, keys and history |
| [Live data and navigation](product/live-data.md) | Providers, cache states, languages and routing |
| [Development setup](development/setup.md) | Local preview, checks and packaging |
| [HUD transport](architecture/hud-transport.md) | Image containers, update order and busy state |
| [SDK compatibility](reference/compatibility.md) | Candidate requirements and hardware evidence |
| [Privacy and limitations](reference/privacy-and-limitations.md) | Data flow, attribution and verification limits |
| [Add a language](i18n/adding-a-language.md) | Locale registry and feed requirements |
| [Documentation writing rules](reference/documentation-style.md) | STE principles and evidence-preservation rules |

## Release operations

Complete the [mandatory pre-deployment checklist](releases/pre-deployment-checklist.md) before every upload.
Run `npm run release:check`. Do not bypass a failed origin audit.

- [v0.2.8 candidate](releases/2026-11-10-public-candidate-028.json): submitted on November 10 and In review at the recorded checkpoint.
- [v0.2.7 decision](releases/2026-11-09-public-candidate-027.json): rejected for undeclared bundled URL origins.
- [API operations](maintenance/2026-11-09-public-api-operations.md): deployed version, request limits and operational duties.

See the [documentation review checkpoint](reference/documentation-review.md) for scope and preservation checks.

## Dated research and experiments

The [record catalog](records.md) links research, physical checks, maintenance audits, specifications and implementation plans.
Each record retains its original date, configuration and evidence.
Specifications and plans are not proof of completed work.

Paths under `output/` identify local evidence. Those private files are not published with the repository.
Do not upload private evidence to repair a link in a historical record.
