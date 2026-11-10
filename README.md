# Sandevistan

A personal dashboard for Even Realities G2 glasses, with an R1 ring and phone companion.

![Dashboard and detail views](docs/design/sandevistan-g2-showcase.png)

**Release:** v0.2.8 is In review in Even Hub. It is not publicly approved or published.
The candidate uses SDK `0.0.16` and requires Even app `2.2.10` or later.
Physical G2 regression checks for this SDK remain pending.

## Features

- Maps, weather, RSS news and tasks without an OpenAI key.
- Hold-to-speak Ask AI with live captions and scrollable answers.
- Conversate captions, translation, Inform and Copilot, with cue history.
- Auto, Light and Dark phone themes, with G2 and R1 battery information.
- 180 bundled languages and 540 configured RSS entries.
- Optional OpenRouteService navigation.

AI requires your own paid OpenAI API account. Navigation requires your own OpenRouteService key.

## Run locally

Use Node.js `22.12+` on the `22.x` line. The verified version is `22.23.2`.

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

Open `/hud-canvas-fast` for the phone and Canvas preview.
Use the Even app bridge for glasses output. See [development setup](docs/development/setup.md) for device access.

## Documentation

| Read this document | To find |
| --- | --- |
| [Documentation index](docs/index.md) | Current guides and dated evidence |
| [Product guide](docs/product/overview.md) | Phone settings, glasses pages and gestures |
| [AI guide](docs/product/ai.md) | Ask AI, Conversate, keys and local history |
| [Live data and navigation](docs/product/live-data.md) | Providers, languages, caches and routing |
| [Development setup](docs/development/setup.md) | Installation, builds, tests and packaging |
| [HUD transport](docs/architecture/hud-transport.md) | Canvas tiles and update rules |
| [SDK compatibility](docs/reference/compatibility.md) | Supported candidate and historical hardware results |
| [Privacy and limitations](docs/reference/privacy-and-limitations.md) | Data flow, attribution and pending checks |
| [Release checklist](docs/releases/pre-deployment-checklist.md) | Mandatory checks before every upload |

## Build and release

```bash
npm run release:check
```

The release command checks types, tests, the package and its network origins.
`npm run pack` also blocks packaging if the built client references an undeclared origin.
Store publication requires a separate Even Hub review.

## Contribute

Keep the four-tile display contract and bounded image transport.
Do not add refresh queues or commit credentials. Keep tracked Markdown in English.
Read the [contribution rules](docs/development/setup.md#contribution-rules) before changing the app.

The source uses the [MIT License](LICENSE).
This unofficial fan project has no affiliation with Even Realities or CD PROJEKT RED.
Names and trademarks belong to their owners. See [attribution](docs/reference/privacy-and-limitations.md#license-and-trademarks).
