# Ask AI Function Tools Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Extend the continuous text-only Ask AI conversation with three built-in
read-only functions—current time, exact current location, and live web
search—and user-configured remote MCP servers. The model chooses whether a tool
is needed and continues the same Realtime turn after its result. Tool execution
must preserve the existing G2 microphone, native Text-container presentation,
tap interruption, and double-tap exit behavior.

## Tool contract

The Realtime session advertises `tool_choice: auto` and these function tools:

- `get_current_time` takes no arguments and returns the device-local ISO time,
  UTC offset, IANA timezone, locale, and localized display time.
- `get_current_location` takes no arguments and returns the latest exact SDK
  latitude and longitude together with accuracy, speed, heading, source, and
  fix timestamp when available.
- `search_web` takes a required bounded query and performs one OpenAI Responses
  API request with the hosted `web_search` tool. It returns a concise result and
  a bounded list of cited source titles and URLs.

Run time and location tools inside the WebView.
Run web search through a same-origin Worker endpoint to avoid exposing the standard BYOK to another browser request target.
Accept the key only in the existing private request header.
Forward it to OpenAI for that request.
Never persist, log, or return the key.

Exact coordinates are disclosed to OpenAI only after the model explicitly
calls `get_current_location`. They are not inserted into session instructions,
attached to ordinary search calls, or sent during session startup. A demo
coordinate, missing fix, or unusably old fix returns a structured unavailable
result instead of pretending to be the user's current location.

## Realtime flow

If a completed Realtime response contains function-call output items, validate each function name and its JSON arguments.
Execute each recognized call once.
For every call ID, send a `conversation.item.create` item of type `function_call_output`.
After the local WebSocket send path acknowledges all outputs, send one `response.create` to continue the turn.

Call IDs are deduplicated for the lifetime of the session. Unknown tools,
invalid arguments, unavailable device data, upstream rejection, timeout, and
abort all produce small structured error outputs. No failed tool call is
queued, retried, or replayed on a later event.

While a function runs, keep the visible protocol in its thinking or tool state.
On a normal detail tap, abort an active search or cancel the follow-up model response.
Reveal the latest received text and return to listening with the microphone open.
On double tap, abort all active tool work before closing Realtime and restoring the Canvas dashboard.
Ignore late tool results and model deltas from cancelled turns.

## User-configured MCP servers

The phone Ask AI detail screen gains a local MCP server manager. A user may
add, rename, edit, enable, disable, and delete remote servers. Each record
contains a display name, an HTTPS server URL, an optional bearer token, and an
optional comma-separated allowlist of tool names. The manager stores records
only in Even local storage and masks authentication values after save. URLs,
labels, token lengths, tool-name syntax, record count, and serialized size are
strictly bounded.

At session start, convert enabled records to Realtime `mcp` tools.
Give each tool a stable, unique `server_label` and a `server_url`.
Include optional `authorization` and `allowed_tools` values.
Enable `require_approval`.
The OpenAI Realtime service connects directly to the MCP server.
Sandevistan's Worker does not proxy, inspect, or persist MCP traffic or credentials.
Phone configuration edits affect only the next AI session.
They must not change a live session during an active response.

Require explicit approval for every user-added MCP call.
When Realtime emits `mcp_approval_request`, temporarily replace the native listening status with a localized approval prompt.
Include the configured server name, tool name, and a short, bounded argument summary:

- one tap sends an `mcp_approval_response` with `approve: true` and returns to
  the thinking state;
- double tap first sends `approve: false`, then performs the normal AI-detail
  exit and microphone cleanup;
- while no approval is pending, one tap retains its established response
  interruption behavior.

Never approve an MCP request automatically, queue it, or reuse its approval for another call.
Show MCP list, import, and call failures as localized nonfatal conversation errors.
Keep the microphone open after these failures.
On session stop, attempt to reject pending approvals before closing the socket.
Remote MCP servers do not automatically receive the whole transcript.
Warn users that these servers receive model-selected arguments and may perform external actions after approval.

## Web-search endpoint

Add `POST /api/ai-web-search` to the shared server router and Worker build. The
request contains only a query and active locale. The handler:

1. applies the existing OpenAI-key validation and strict JSON/body limits;
2. validates query length and rejects control characters;
3. calls the OpenAI Responses API with one supported search-capable model and
   the `web_search` tool;
4. requests source metadata, extracts only output text and URL citation
   annotations, and returns a bounded normalized payload;
5. aborts on a short timeout and maps upstream failures to generic client-safe
   errors.

Never include the BYOK in response bodies or diagnostic logs.
Treat search output as untrusted data.
Use plain text for titles and snippets.
Allow only HTTPS result URLs.
Bound result counts and lengths.

## Citations and local history

Glasses responses use compact numeric source markers such as `[1]`. Because a
glasses Text container cannot open links, the same turn stores its normalized
source list alongside the local conversation excerpt. The phone Ask AI detail
screen renders those source titles as clearly visible HTTPS links. Only cited
sources returned by OpenAI are stored, with the same existing bounded recent
history policy; raw search payloads and page contents are not persisted.

The history schema gains an optional sources field and remains backward
compatible with records saved before function tools. Resetting AI history also
removes stored source metadata.

## Cost accounting

Continue recording Realtime usage in the existing ledger.
The search endpoint also returns Responses API token usage and web-search action counts.
Aggregate them in the same device-local daily usage record under a versioned search category.
Include that category in weekly and monthly estimates.
Keep pricing centralized.
If tool pricing is unknown or changed, label the estimate incomplete instead of inventing a price.

## Localization

Tool definitions instruct the model to use the active locale.
Add local visible states and errors to the centralized Ask AI dictionary for all thirty locales.
Cover searching, location unavailable, tool timeout, search failure, and MCP loading, approval, rejection, and failure.
Keep tool names and JSON keys as stable English protocol identifiers.
Never display those identifiers as user-facing labels.

## Verification

- Protocol tests prove all three tools appear in `session.update`, complete
  function calls generate matching `function_call_output` items, duplicate
  call IDs are ignored, and exactly one follow-up response is created.
- Session tests prove current-time formatting, exact live-location output,
  rejection of demo/unavailable fixes, search success, failure, timeout, tap
  abort, and stop cleanup.
- API tests cover authentication, request bounds, OpenAI request shape,
  citation normalization, usage normalization, unsafe URLs, upstream errors,
  timeout, and key non-disclosure.
- Runtime/history tests cover source retention, backward compatibility, search
  usage aggregation, and reset behavior.
- Phone tests prove cited sources are visible and clickable and that all new
  local UI strings exist in every supported locale.
- MCP tests cover local-only credential storage, validation and masking,
  session tool construction, optional allowlists, lifecycle events, tap
  approval, exit rejection, failure recovery, and credential non-disclosure.
- Run typecheck, Vitest, server/Worker tests, production build, and package
  verification without a real OpenAI key.
