# Ask AI Built-in Tools and MCP Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commit: `d715c6e`; Web-search preview fix: `fb7dfb9`

> **Goal:** Extend the glasses-native Ask AI session with exact local time, explicitly requested exact G2 location, grounded web search, and user-managed remote MCP servers while preserving the existing no-queue, tap-interrupt interaction model.

## Constraints

- OpenAI and MCP credentials remain in Even storage and are never logged or persisted by the application server.
- Exact coordinates are exposed only after the model explicitly calls the location function.
- Web search is a bounded same-origin BYOK request. Results carry source metadata into local conversation history.
- Every MCP invocation requires approval on the glasses. One tap approves. Double tap rejects and exits.
- Enabled MCP configuration is captured when a new Ask AI session starts. Editing settings never mutates an active session.
- Tool work has no retry/replay queue. A cancelled, failed, duplicate, or busy call stays failed and a later model turn may try again.

## Task 1: Define and test durable configuration models

**Files:** `src/mcp-servers.ts`, `src/mcp-servers.test.ts`, `src/ai-tools.ts`, `src/ai-tools.test.ts`

1. Add failing tests for MCP URL/auth/tool-list validation, bounded storage, masking, and Realtime tool projection.
2. Add failing tests for deterministic time output, live-only exact location, stale/demo rejection, and bounded tool argument parsing.
3. Implement the smallest validators and serializers that satisfy those tests.

## Task 2: Add and test the web-search boundary

**Files:** `server/ai-web-search.js`, `server/openai-auth.js`, `server/api-router.js`, `server/http.js`, `tests/ai-web-search-api.test.mjs`, `scripts/prepare-sites-build.mjs`, `package.json`

1. Add API tests for missing/invalid credentials, invalid JSON/query, upstream timeout/rejection, bounded response parsing, citations, and usage.
2. Extract shared OpenAI-key validation without changing the Realtime token contract.
3. Implement the Responses API `web_search` proxy with request/response size limits, timeout, no-store responses, HTTPS sources only, and sanitized errors.
4. Register and package the route, then run the focused Node tests.

## Task 3: Integrate Realtime function calls and MCP approvals

**Files:** `src/ai-realtime-protocol.ts`, `src/ai-realtime-session.ts`, `src/ai-realtime-session.test.ts`, `src/ai-realtime-protocol.test.ts`, `src/ai-web-search.ts`

1. Add failing protocol tests proving the session registers three function tools and enabled MCP servers with per-call approval.
2. Add failing session tests for function-call output/follow-up response, duplicate suppression, exact-location failure, search cancellation, MCP approval/rejection, and stop-time rejection.
3. Implement one in-flight function batch with `AbortController`; execute calls once by call ID and issue one follow-up `response.create` after outputs.
4. Implement pending MCP approval state and explicit response events. Reject pending approval before session shutdown.

## Task 4: Connect runtime, history, and glasses UI

**Files:** `src/ai-runtime.ts`, `src/fast-hud-controller.ts`, `src/ai-hud-state.ts`, `src/native-ai-text.ts`, `src/ai-history.ts`, related tests

1. Add failing tests showing runtime resolves MCP servers at session start, supplies the current live location, approves on tap, and preserves citations.
2. Extend snapshots with a sanitized approval prompt and search sources.
3. Make normal tap approve only while approval is pending. Otherwise retain response interruption/flush behavior.
4. Persist bounded HTTPS citations with the latest conversation excerpt and render them as reference markers on glasses.

## Task 5: Add phone MCP management and localization

**Files:** `src/phone/McpServersPanel.tsx`, `src/phone/AiScreen.tsx`, `src/phone/AiScreen.test.tsx`, `src/ai-i18n.ts`, `src/ai-hud-i18n.ts`, CSS

1. Add UI tests for add, edit, enable/disable, masked auth, allowlist, and delete.
2. Implement a compact MCP manager inside Ask AI settings using the established white-panel visual system.
3. Add complete strings for all 30 supported locales, including the glasses approval/listening/tool states.
4. Render conversation source links visibly and clickably in phone history.

## Task 6: Verify, review, publish, and serve

1. Run focused tests after each task, then `npm test`, `npm run typecheck`, `npm run build`, `npm run test:sites`, and `npm run test:repo`.
2. Review the diff for credential leakage, exact-location disclosure, retry queues, file-size regressions, and accidental unrelated changes.
3. Commit and push `main`.
4. Refresh the existing Tailscale-accessible preview server and report the exact test URL.
