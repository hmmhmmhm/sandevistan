# Ask AI Tool Status, Pacing, and Cost Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commits: `ffa7a57`, `b7547be`, `09bdbe0`, `153bf87`, and
`efd4414`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add localized Ask AI tool activity, user-controlled 200 ms grapheme pacing with a tap-to-reveal hint, and model-aware event-time Realtime/search cost estimates.

**Architecture:** Realtime protocol/session state owns tool lifecycles and response completion, while the existing single-timer presentation pacer projects a safe HUD snapshot. Phone preferences own the pacing interval, and a versioned integer nano-USD pricing module records immutable event-time cost snapshots alongside raw usage. Native-text and canvas HUD paths consume one shared localized status formatter.

**Tech Stack:** TypeScript, React, Vitest, Node test runner, OpenAI Realtime/Responses APIs, Even Realities SDK, Vite.

---

### Task 1: Versioned pricing and search usage envelope

**Files:**
- Create: `src/ai-pricing.ts`
- Create: `src/ai-pricing.test.ts`
- Modify: `src/ai-cost.ts`
- Modify: `src/ai-cost.test.ts`
- Modify: `src/ai-tools.ts`
- Modify: `src/ai-web-search.ts`
- Modify: `server/ai-web-search.js`
- Modify: `tests/ai-web-search-api.test.mjs`

- [ ] **Step 1: Write failing pricing and migration tests**

Add tests that assert the exact nano-USD values and immutable ledger behavior:

```ts
expect(priceRealtimeUsage({
  model: "gpt-realtime",
  textInputTokens: 1_000_000,
  cachedTextInputTokens: 1_000_000,
  audioInputTokens: 1_000_000,
  cachedAudioInputTokens: 1_000_000,
  textOutputTokens: 1_000_000,
})).toMatchObject({ estimatedNanoUsd: 52_800_000_000, unpricedEvents: 0 })

expect(priceSearchUsage({
  model: "gpt-5.5",
  inputTokens: 1_000_000,
  cachedInputTokens: 200_000,
  outputTokens: 1_000_000,
  webSearchCalls: 2,
})).toMatchObject({ estimatedNanoUsd: 34_120_000_000, unpricedEvents: 0 })

expect(priceSearchUsage({
  model: "future-model",
  inputTokens: 10,
  cachedInputTokens: 0,
  outputTokens: 5,
  webSearchCalls: 1,
})).toMatchObject({ estimatedNanoUsd: 10_000_000, unpricedEvents: 1 })
```

Add ledger tests for these conditions:

- New entries sum stored `estimatedNanoUsd`.
- Old entries migrate once with the legacy estimator.
- Week/month ranges use local dates.
- An unknown-model event makes `hasUnpricedUsage` true.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npx vitest run src/ai-pricing.test.ts src/ai-cost.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `ai-pricing.ts`, cost snapshots, cached search input, and summary flags do not exist.

- [ ] **Step 3: Implement integer event-time pricing**

Create these public contracts in `src/ai-pricing.ts`:

```ts
export const AI_PRICING_VERSION = "openai-2026-08-02-standard" as const
export interface AiUsageCharge {
  estimatedNanoUsd: number
  unpricedEvents: number
  pricingVersions: string[]
}
export function emptyAiUsageCharge(): AiUsageCharge
export function mergeAiUsageCharge(left: AiUsageCharge, right: AiUsageCharge): AiUsageCharge
export function priceRealtimeUsage(input: RealtimePricingInput): AiUsageCharge
export function priceTranscriptionUsage(input: TranscriptionPricingInput): AiUsageCharge
export function priceSearchUsage(input: SearchPricingInput): AiUsageCharge
```

Use integer nano-USD-per-token rates: Realtime text `4000/400/16000`, audio `32000/400`; transcription audio/text `1250/5000`; gpt-5.5 search input/cached/output `5000/500/30000`; and `10_000_000` nano-USD per billable search action. Accept `gpt-5.5` snapshot suffixes. Unknown models price only known action fees and increment `unpricedEvents`.

Extend `AiUsage` with `cachedSearchTextInputTokens`. Store `{usage, charge}` in each new daily ledger entry; validate legacy `{date, usage}` entries and migrate them with an explicitly named legacy pricing version. Return `{weekUsd, monthUsd, hasUnpricedUsage}` from the range summary while keeping raw usage aggregation available for diagnostics.

- [ ] **Step 4: Run pricing tests and confirm GREEN**

Run: `npx vitest run src/ai-pricing.test.ts src/ai-cost.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Write failing search envelope tests**

Update the API fixture to include `model: "gpt-5.5-2026-07-01"`, `usage.input_tokens_details.cached_tokens`, one `search` action, and one non-search action. Assert the endpoint returns:

```js
{
  model: "gpt-5.5-2026-07-01",
  inputTokens: 120,
  cachedInputTokens: 20,
  outputTokens: 30,
  webSearchCalls: 1,
}
```

Add client tests rejecting blank/oversized model identifiers, negative counters, and cached input greater than total input.

- [ ] **Step 6: Run search tests and confirm RED**

Run: `node --test tests/ai-web-search-api.test.mjs && npx vitest run src/ai-tools.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the endpoint and client currently omit model/cached usage and count every `web_search_call`.

- [ ] **Step 7: Implement and validate the search envelope**

Return the upstream model, total input, cached input, output, and only `web_search_call` items whose `action.type === "search"`. Extend `AiWebSearchUsage` accordingly. Clamp all token counts to non-negative safe integers. Require cached input not to exceed total input. Never accept price information from the client or upstream payload.

- [ ] **Step 8: Run search tests and confirm GREEN**

Run: `node --test tests/ai-web-search-api.test.mjs && npx vitest run src/ai-tools.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 9: Commit pricing and search accounting**

```bash
git add src/ai-pricing.ts src/ai-pricing.test.ts src/ai-cost.ts src/ai-cost.test.ts src/ai-tools.ts src/ai-web-search.ts server/ai-web-search.js tests/ai-web-search-api.test.mjs
git commit -m "feat: add model-aware Ask AI cost accounting"
```

### Task 2: Explicit built-in and MCP tool lifecycle

**Files:**
- Modify: `src/ai-realtime-protocol.ts`
- Modify: `src/ai-realtime-protocol.test.ts`
- Modify: `src/ai-realtime-tools.ts`
- Modify: `src/ai-realtime-session.ts`
- Modify: `src/ai-realtime-session.test.ts`
- Modify: `src/ai-hud-state.ts`
- Modify: `src/ai-hud-state.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Test the safe state shape and stale-event guards:

```ts
expect(state.activeTool).toEqual({
  id: "call-search-1",
  kind: "web-search",
})
expect(clearActiveTool(state, "older-call").activeTool).toEqual(state.activeTool)
expect(clearActiveTool(state, "call-search-1").activeTool).toBeUndefined()
```

Cover built-in time/location/search start, success, failure, cancellation, and parallel calls. Cover MCP `response.mcp_call.in_progress`, completed/failed output items, response completion, socket cleanup, and approval priority. Assert the HUD snapshot contains only `{id, kind, displayName?}`, never arguments, queries, keys, or tool output.

- [ ] **Step 2: Run lifecycle tests and confirm RED**

Run: `npx vitest run src/ai-realtime-protocol.test.ts src/ai-realtime-session.test.ts src/ai-hud-state.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `activeTool` and `responseComplete` are absent.

- [ ] **Step 3: Implement protocol-owned lifecycle state**

Add these bounded types and state fields:

```ts
export type AiToolKind = "time" | "location" | "web-search" | "mcp" | "generic"
export interface AiActiveTool {
  id: string
  kind: AiToolKind
  displayName?: string
}

interface AiRealtimeProtocolState {
  activeTool?: AiActiveTool
  responseComplete: boolean
  // existing fields remain unchanged
}
```

The built-in runner maintains a `Map<callId, AiActiveTool>`, publishes the first active entry on start/removal, and removes the matching call in `finally`. MCP event parsing creates/clears the matching `mcp` lifecycle. `response.created` clears completion; `response.done` sets completion and defensively clears active tools; cancellation, failure, close, and cleanup also clear both safely.

Project the safe lifecycle and completion values into `AiHudSnapshot`. Integrate search usage pricing with uncached input computed as `inputTokens - cachedInputTokens`, and merge the event-time charge into protocol/runtime state.

- [ ] **Step 4: Run lifecycle tests and confirm GREEN**

Run: `npx vitest run src/ai-realtime-protocol.test.ts src/ai-realtime-session.test.ts src/ai-hud-state.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit lifecycle state**

```bash
git add src/ai-realtime-protocol.ts src/ai-realtime-protocol.test.ts src/ai-realtime-tools.ts src/ai-realtime-session.ts src/ai-realtime-session.test.ts src/ai-hud-state.ts src/ai-hud-state.test.ts
git commit -m "feat: expose safe Ask AI tool activity"
```

### Task 3: Dynamic grapheme pacing and tap-to-reveal state

**Files:**
- Modify: `src/ai-presentation-pacer.ts`
- Modify: `src/ai-presentation-pacer.test.ts`
- Modify: `src/ai-runtime.ts`
- Modify: `src/ai-runtime.test.ts`
- Modify: `src/fast-hud-controller.ts`

- [ ] **Step 1: Write failing pacer tests**

Use fake timers to verify these conditions:

- The default interval is 200 ms.
- Each tick reveals one Unicode grapheme.
- Values clamp to 100–1000 and snap to 50.
- Changing a getter from 200 to 600 affects the next scheduled tick.
- At most one timer and one presentation ACK exist.
- `canRevealFullResponse` is true only when `responseComplete` is true and target text is ahead.
- `flush()` reveals the completed target in one acknowledged frame.

- [ ] **Step 2: Run pacer tests and confirm RED**

Run: `npx vitest run src/ai-presentation-pacer.test.ts src/ai-runtime.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the default is 250 ms and there is no dynamic interval or reveal state.

- [ ] **Step 3: Implement the single-timer dynamic pacer**

Extend the pacer options without adding an output queue:

```ts
interface AiPresentationPacerOptions {
  present(snapshot: AiHudSnapshot): Promise<void>
  getIntervalMs?: () => number
}

export function normalizeAiPresentationInterval(value: unknown): number {
  const finite = typeof value === "number" && Number.isFinite(value) ? value : 200
  return Math.min(1000, Math.max(100, Math.round(finite / 50) * 50))
}
```

Read the normalized getter every time the sole next tick is scheduled. Derive `canRevealFullResponse` from response completion plus target/presented grapheme difference. Cancel the single pending timer during flush/reset/dispose and retain the existing serialized presentation acknowledgement.

Add `getPresentationIntervalMs` to `createAiRuntime`, pass `() => phonePreferencesRef.current.aiTextIntervalMs` from `fast-hud-controller.ts`, and preserve the current interrupt behavior: approval first, generating response cancellation second, completed delayed response flush third.

- [ ] **Step 4: Run pacer tests and confirm GREEN**

Run: `npx vitest run src/ai-presentation-pacer.test.ts src/ai-runtime.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit pacing behavior**

```bash
git add src/ai-presentation-pacer.ts src/ai-presentation-pacer.test.ts src/ai-runtime.ts src/ai-runtime.test.ts src/fast-hud-controller.ts
git commit -m "feat: make Ask AI response pacing configurable"
```

### Task 4: Complete localization and consistent HUD rendering

**Files:**
- Modify: `src/ai-hud-i18n.ts`
- Modify: `src/ai-hud-i18n.test.ts`
- Modify: `src/ai-i18n.ts`
- Modify: `src/ai-i18n.test.ts`
- Modify: `src/native-ai-text.ts`
- Modify: `src/native-ai-text.test.ts`
- Modify: `src/fast-ai-hud.ts`

- [ ] **Step 1: Write failing locale completeness and rendering tests**

For every registered locale, require non-empty localized values for `toolTime`, `toolLocation`, `toolWebSearch`, `toolMcp`, `toolGeneric`, `tapReveal`, `responseSpeed`, `millisecondsPerCharacter`, and `unpricedUsage`. Assert rendering priority exactly follows: MCP approval, active tool, delayed display, normal phase/error. Assert native text and canvas use the same formatter, tool status never enters transcript/history, and `tapReveal` is present only when `canRevealFullResponse`.

- [ ] **Step 2: Run i18n/render tests and confirm RED**

Run: `npx vitest run src/ai-hud-i18n.test.ts src/ai-i18n.test.ts src/native-ai-text.test.ts --no-file-parallelism --maxWorkers=1`

Expected: FAIL because the new keys and formatter do not exist.

- [ ] **Step 3: Add complete 30-locale catalogs and shared status formatter**

Extend the compile-time `Record<SupportedLocale, AiHudStrings>` for all registered locales:

- `en`
- `ko`
- `ja`
- `zh-Hans`
- `zh-Hant`
- `es`
- `fr`
- `de`
- `it`
- `pt`
- `nl`
- `pl`
- `ru`
- `uk`
- `tr`
- `ar`
- `he`
- `hi`
- `bn`
- `id`
- `vi`
- `th`
- `ms`
- `fil`
- `sv`
- `no`
- `da`
- `fi`
- `cs`
- `ro`

Add a complete phone catalog for the three preference/cost strings rather than relying on English fallback.

Expose one formatter:

```ts
export function aiHudStatusLabel(strings: AiHudStrings, snapshot: AiHudSnapshot): string {
  if (snapshot.pendingApproval) return strings.approvalRequired
  if (snapshot.activeTool?.kind === "time") return strings.toolTime
  if (snapshot.activeTool?.kind === "location") return strings.toolLocation
  if (snapshot.activeTool?.kind === "web-search") return strings.toolWebSearch
  if (snapshot.activeTool?.kind === "mcp") return snapshot.activeTool.displayName
    ? `${strings.toolMcp}: ${snapshot.activeTool.displayName}`
    : strings.toolMcp
  if (snapshot.activeTool) return strings.toolGeneric
  if (snapshot.phase === "displaying") return strings.displaying
  return phaseLabel(strings, snapshot.phase)
}
```

Use it in native and canvas paths. Keep active status at the top, retain the transcript body, and reserve the bottom line for the reveal hint when eligible.

- [ ] **Step 4: Run i18n/render tests and confirm GREEN**

Run: `npx vitest run src/ai-hud-i18n.test.ts src/ai-i18n.test.ts src/native-ai-text.test.ts --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit localized HUD state**

```bash
git add src/ai-hud-i18n.ts src/ai-hud-i18n.test.ts src/ai-i18n.ts src/ai-i18n.test.ts src/native-ai-text.ts src/native-ai-text.test.ts src/fast-ai-hud.ts
git commit -m "feat: localize Ask AI tool and reveal status"
```

### Task 5: Phone pacing preference and cost transparency

**Files:**
- Modify: `src/phone-types.ts`
- Modify: `src/phone-preferences.ts`
- Modify: `src/phone-preferences.test.ts`
- Modify: `src/phone/AiScreen.tsx`
- Modify: `src/phone/AiScreen.test.tsx`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone/PhoneCompanion.test.tsx`
- Modify: `src/phone/phone-detail.css`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing preference and UI tests**

Test missing preferences migrate to 200, invalid values clamp/snap, and save/load preserves the value without touching ORS/OpenAI keys. Render `AiScreen`. Assert a range input with `min=100`, `max=1000`, `step=50`, and the current localized `200 ms` value. Verify persistence on change and week/month estimates including search costs. Show a localized unpriced warning only when the summary flag is true.

- [ ] **Step 2: Run phone tests and confirm RED**

Run: `npx vitest run src/phone-preferences.test.ts src/phone/AiScreen.test.tsx src/phone/PhoneCompanion.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: FAIL because `aiTextIntervalMs`, slider props, and unpriced summary are absent.

- [ ] **Step 3: Implement persisted phone control and summaries**

Add `aiTextIntervalMs: number` to `PhonePreferences`, defaulting through `normalizeAiPresentationInterval(undefined)`. Keep the stored field optional in the raw validator for migration, then always return a complete normalized preference.

Pass these props through `PhoneCompanion` to `AiScreen`:

```ts
presentationIntervalMs: number
onPresentationIntervalChange(value: number): Promise<boolean>
```

Save `{...preferences, aiTextIntervalMs: normalized}` through the existing storage method. The slider uses the complete localized labels and exposes the numeric value accessibly. Update `App.tsx` to derive the new cost summary from stored nano-USD snapshots and set `costHasUnpriced` on the HUD/phone snapshot.

- [ ] **Step 4: Run phone tests and confirm GREEN**

Run: `npx vitest run src/phone-preferences.test.ts src/phone/AiScreen.test.tsx src/phone/PhoneCompanion.test.tsx src/App.test.tsx --no-file-parallelism --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit phone controls**

```bash
git add src/phone-types.ts src/phone-preferences.ts src/phone-preferences.test.ts src/phone/AiScreen.tsx src/phone/AiScreen.test.tsx src/phone/PhoneCompanion.tsx src/phone/PhoneCompanion.test.tsx src/phone/phone-detail.css src/App.tsx src/App.test.tsx
git commit -m "feat: add Ask AI pacing and cost controls"
```

### Task 6: End-to-end verification and delivery

**Files:**
- Modify if generated by build: none committed unless already tracked
- Verify: `README.md`, `app.json`, `package.json`

- [ ] **Step 1: Run all source tests**

Run: `npm test`

Expected: all Vitest suites pass with no unhandled errors.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 3: Run API/Sites and repository tests**

Run: `npm run test:sites && npm run test:repo`

Expected: production build succeeds and all Node suites pass.

- [ ] **Step 4: Build and package the Even Hub artifact**

Run: `npm run pack`

Expected: Vite build and `evenhub pack` complete successfully, producing `sandevistan.ehpk` without publishing npm packages.

- [ ] **Step 5: Inspect the final diff and secret scan**

Run: `git diff --check && git status --short && git diff origin/main -- . ':(exclude)docs/superpowers/specs/2026-08-02-ask-ai-tool-status-pacing-cost-design.md' ':(exclude)docs/superpowers/plans/2026-08-02-ask-ai-tool-status-pacing-cost.md' && rg -n "sk-(proj-)?[A-Za-z0-9_-]{20,}" . --glob '!node_modules/**' --glob '!dist/**' --glob '!*.ehpk'`

Expected: no whitespace errors, only intended tracked changes, and no API key matches.

- [ ] **Step 6: Commit any final integration-only fixes**

```bash
git add -u
git commit -m "test: verify Ask AI status pacing and costs"
```

Skip this commit when verification required no code changes.

- [ ] **Step 7: Push main and restart the Tailscale preview**

Run: `git push origin main`

Then start the production preview on the established Tailscale port:

```bash
npm run preview -- --host 0.0.0.0 --port 4179
```

Expected: the server reports `http://100.127.255.11:4179/`. The user can open `/hud-canvas-fast?sdk=0.0.13` on the physical glasses.
