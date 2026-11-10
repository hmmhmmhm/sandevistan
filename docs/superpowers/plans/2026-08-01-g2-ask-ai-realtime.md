# G2 Ask AI Realtime Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Initial implementation commit: `4d3ccaa` (`feat: add realtime Ask AI HUD`)

The presentation and tool layers were subsequently evolved by the native Text,
line-stream, tap-interrupt, tool, pacing, and binocular-settle plans below.

> Execute this plan with test-first changes. Never place a real API key in a
> command, fixture, source file, build artifact, diagnostic, or commit.

## Task 1: Local key, history, usage, and pricing domain

**Files:** `src/openai-key.ts`, `src/openai-key.test.ts`, `src/ai-history.ts`,
`src/ai-history.test.ts`, `src/ai-cost.ts`, `src/ai-cost.test.ts`

1. Write failing tests for OpenAI key validation, masking, storage, and clear.
2. Implement the smallest storage functions using `EvenStorage`.
3. Write failing tests for three-session excerpt retention and bounded text.
4. Implement local history normalization and persistence.
5. Write failing tests for daily usage aggregation and local week/month ranges.
6. Implement model pricing in one registry and estimated USD totals.

## Task 2: Realtime token endpoint

**Files:** `server/realtime.js`, `server/api-router.js`,
`scripts/prepare-sites-build.mjs`, `tests/realtime-api.test.mjs`,
`tests/sites-worker.test.mjs`

1. Write endpoint tests for missing/invalid key, upstream success, upstream
   rejection, timeout, and secret-free errors.
2. Add the same-origin endpoint and strict BYOK header validation.
3. Add the module to the production Sites bundle and route it through the
   existing API router.

## Task 3: Realtime protocol and G2 audio session

**Files:** `src/ai-realtime-protocol.ts`,
`src/ai-realtime-protocol.test.ts`, `src/ai-realtime-session.ts`,
`src/ai-realtime-session.test.ts`

1. Write tests for text-only session configuration, semantic VAD, locale
   instructions, and 16 kHz PCM append events.
2. Write reducer tests for speech/transcription/response/error events and
   detailed usage fields.
3. Write lifecycle tests proving the microphone starts only after explicit
   session start and always closes on stop/error.
4. Implement the ephemeral token request, browser WebSocket connection, G2
   audio subscription, bounded PCM buffering, event reduction, and cleanup.

## Task 4: Latest-wins AI refresh state

**Files:** `src/ai-hud-state.ts`, `src/ai-hud-state.test.ts`,
`src/ai-refresh-scheduler.ts`, `src/ai-refresh-scheduler.test.ts`

1. Test passive dashboard state, session state transitions, transcript paging,
   pause/resume, stop, and completed excerpt creation.
2. Test a 300 ms latest-wins scheduler with no retry queue and an immediate
   final-event attempt.
3. Implement the controller-independent AI state and scheduler.

## Task 5: Fast HUD page and detail integration

**Files:** `src/fast-hud-pages.ts`, `src/fast-hud-pages.test.ts`,
`src/fast-hud-view.ts`, `src/fast-hud-view.test.ts`,
`src/fast-canvas-pages.ts`, `src/fast-canvas-hud.test.ts`,
`src/fast-detail-hud.ts`, `src/fast-detail-hud.test.ts`,
`src/fast-hud-controller.ts`, `src/hud-controller-types.ts`, `src/App.tsx`

1. Add failing navigation tests for optional Ask AI ordering and explicit
   enter/pause/resume/exit effects.
2. Add rendering tests for passive excerpts/cost and live transcript/error
   detail states.
3. Wire the AI session lifecycle into the fast controller. Enter starts a new
   session, tap toggles capture, double tap stops before returning, and cleanup
   always stops.
4. Route streaming state through the latest-wins scheduler and existing
   busy-drop image transport.

## Task 6: Phone companion BYOK and usage screen

**Files:** `src/phone-types.ts`, `src/phone-preferences.ts`,
`src/phone-preferences.test.ts`, `src/phone-icons.tsx`,
`src/phone/PhoneCompanion.tsx`, `src/phone/PhoneHome.tsx`,
`src/phone/AiScreen.tsx`, `src/phone/AiScreen.test.tsx`,
`src/phone/HudLayoutScreen.tsx`, `src/phone/PhoneCompanion.test.tsx`,
`src/phone/phone-detail.css`

1. Add Ask AI to the configurable page model and phone dashboard.
2. Test masked key save/delete, estimated week/month display, token details,
   excerpt display, and local data reset.
3. Implement the white Even-style AI card and focused detail screen.
4. Keep the default layout migration safe for existing stored preferences.

## Task 7: Localization and manifest permissions

**Files:** `src/i18n/locales/*.ts`, `src/i18n/locale-registry.test.ts`,
`app.json`, `src/sdk-version.test.ts`

1. Add typed AI phone/HUD strings to all thirty locale packs, using natural
   English and Korean copy and safe translated defaults for the remaining
   packs.
2. Add the G2 microphone and OpenAI network permissions without weakening the
   existing manifest checks.
3. Update locale completeness and manifest tests.

## Task 8: Verification and delivery

1. Run targeted tests after each task.
2. Run `npm test`, `npm run typecheck`, `npm run test:repo`,
   `npm run test:sites`, `npm run build`, and `npm run pack`.
3. Inspect the phone WebView at a mobile viewport without a real key and verify
   Home, HUD layout, and Ask AI detail states.
4. Check `git diff --check`, scan tracked/build files for secret-shaped values,
   commit, and push `main`.
