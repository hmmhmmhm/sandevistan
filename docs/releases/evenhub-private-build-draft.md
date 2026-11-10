# Even Hub private build 0.2.0

Status: uploaded and verified as Private. The owner explicitly approved the
exact change log below before Add build was submitted. The project list and
build details both show 0.2.0 as Private; saved text matches the approved draft.
No public release or beta promotion was performed. The authenticated account's existing latest private
build was 0.1.7, followed by 0.1.6. All development remains on main.

## Approved and submitted change log

Project: SANDEVISTAN (existing project, unchanged name)

Version: 0.2.0

Visibility: Private

Update SDK to 0.0.16 (Even App 2.2.10+). Add the approved four-tile Ask AI and Conversate HUD with smaller text and four-line Inform. Improve voice input, transcript-grounded replies, model selection, automatic scrolling and session cleanup. Connect packaged builds to the map/news API Worker; routing remains optional with your own ORS key.

The owner approved this exact text in chat. It was submitted without changes
and verified in Build details. The earlier shorter draft is superseded.

## Backend and package verification

The owner selected the separate API Worker option. Deployed
`sandevistan-api` at https://sandevistan-api.hmmhmmhm.workers.dev.
The existing X/Twitter-only `sandevistan-x-relay` was preserved; module hashes
and its modification timestamp match the pre-deployment readback.
Deployment evidence: `2026-11-08-api-worker-deployment.json`.

Packaged builds use `.env.evenhub` to connect map, RSS and optional ORS APIs to
this Worker. Local/Sites builds keep their same-origin API behavior. OpenAI
BYOK requests remain direct; the public Worker exposes no AI key proxy.
No OpenAI or Cloudflare credential is included in the package.

The original Overpass provider reported capacity exhaustion. The public API
Worker uses bounded OpenFreeMap vector tiles, decodes the OpenMapTiles schema
into the existing road/label DTO and retains the Canvas renderer. Provider
attribution is displayed in the HUD and linked in the phone footer. The fixed
provider origin, eight-second timeout, bounded payloads and at most four
sequential tile requests prevent arbitrary upstream requests.

Cloudflare Workers does not support Fetch redirect mode `error`. Map and ORS
requests now use `manual` and reject non-success responses without following
redirects. See [Cloudflare Request docs](https://developers.cloudflare.com/workers/runtime-apis/request/).

Final checks: 93 Vitest files / 722 tests; 636 Node tests; simulator TypeScript
check; repository checks; package creation; production dependency audit with
zero vulnerabilities. These are regression/API checks, not physical G2 proof.
The release-only version change from 0.1.2 to 0.2.0 was followed by a fresh pack.
Package size/hash: `2026-11-08-private-build.json`.

Live Worker checks returned 200 for health, BBC and SBS RSS, and both Seoul
and London maps (180 roads / 24 labels each). Browser verification parsed 100
SBS items and rendered the Seoul map through the actual client parsers and
Canvas renderer using cross-origin Worker requests. ORS remains disabled
without the owner's optional key; a real keyed route was not tested.
Evidence: `../../output/private-build-api-2026-11-08/`.

## Installation and remaining validation

Install from Even Realities app, Me / Apps / Private builds, SANDEVISTAN 0.2.0.
Minimum Even App version is 2.2.10. AI uses the owner's OpenAI key saved in the
phone companion; no test key is bundled. Optional routing needs a user ORS key.
Physical G2 microphone/BLE/bilateral/timing behavior remains unverified for this
build. Simulator and synthetic-audio results do not establish hardware approval.

The task browser was stopped and the session inventory is empty. Evidence:
`../../output/private-build-api-2026-11-08/evenhub-private-020.png`.
GitHub changes remain local on main; no commit, push, PR or external post was
made there. The approved Even Hub private changelog is the only release text
submitted in this task.
