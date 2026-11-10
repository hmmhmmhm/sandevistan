# Public release readiness review

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

Reviewed 2026-11-09 on main against the published Private artifact 0.2.6. Verdict at
this checkpoint: suitable for controlled beta validation. Until the exit contract and
physical beta checks below are resolved, do not submit directly to Public. This is an
assessment, not authorization to promote, submit, publish, or contact reviewers.

## Current release and positive evidence

- Private 0.2.6 upload completed with exact approved changelog and Private tag verified
  in Even Hub Build details. Record: ../releases/2026-11-09-private-build-026.json. The
  owner expressly allowed the existing Chrome session for this deployment. Session dadv
  was stopped and the session inventory was empty afterward.
- Full implementation suite: 103 Vitest files / 772 tests passed, both TypeScript checks
  and EvenHub build/package passed. Version-only release verification: 19 tests passed.
  No bundled project-key prefix was found. The package includes local G2/R1 images. It
  embeds no developer OpenAI key.
- Real OpenAI and native simulator evidence covers held captions, final text grounding,
  and repeated Ask AI questions. It also covers sourced city weather, follow-up context,
  busy-input scrolling, and Conversate context cases. Those checks do not replace
  physical locked-phone beta validation. Earlier owner hardware reports and historical
  hardware transport passes are retained. This review does not claim all hardware
  testing is absent.
- Live public Worker checks used Node fetch. Health returned 200 with CORS *. Map
  returned 200 with roads, labels, and attribution. SBS RSS returned 200 with CORS *,
  XML content type, and 102 items. The first news verifier wrongly tried JSON on an RSS
  response and produced SyntaxError. This was a verifier error, not a server failure. An
  initial urllib health request received 403, while Node fetch returned the expected
  Cloudflare JSON 200. These checks are snapshots, not an uptime/load assessment or
  proof of packaged WebView behavior. Artifacts are recorded separately.

## Before Public submission

### P0: root-page exit behavior conflicts with review rules

The official QA guide explicitly requires a root double-tap path to
shutDownPageContainer(1), the system confirmation dialog. An in-app action menu that
contains an Exit action leading to that call is an accepted pattern.

At this checkpoint, fast-hud-view.ts returns unhandled for dashboard double-tap.
fast-canvas-session.ts always supplies a DisplayToggle to transmitCanvas. Consequently,
fast-canvas-transport.ts uses blank-page hide and restore instead of its
no-DisplayToggle shutdown fallback. README.md documents the same behavior. This was
intentional prototype behavior and historically hardware-verified, but it is a
public-review blocker under the current guide.

The existing behavior test passed. It checked that the default blank rebuild hides
without images and restores all four tiles (one selected case, 75 skipped). No behavior
was changed during this review. Preserve detail-to-dashboard navigation. Move display
hiding to a separate action and design/verify a compliant root exit flow. Any new visual
menu must follow the owner's design-approval requirement.

There is an open primary issue report that the native exit confirmation can wedge image
updates after cancellation. The report concerns older firmware and SDK environments. It
does not establish that the current owner hardware still has that defect. Do not adopt
the reported mode-0/custom-confirmation workaround for a Public submission: the official
guide rejects those root exit patterns. Reproduce cancel/confirm behavior on the latest
physical firmware before choosing a fix.

### P0: current physical beta acceptance is unrecorded

Use an installed Beta build, not QR development mode, for the official five-minute phone
lock/background check. Confirm glasses launch, ring/temple input, repeated held Ask AI
turns, Conversate captions/translation/cues, network loss/reconnection, and usable
recovery after unlock/re-lock. Verify confirmed system exit closes the phone WebView,
and a first-party app launches afterward without restarting G2. Test cancelling the
system exit dialog while image output is active.

The latest 0.2.6 theme was browser-tested with example telemetry. Native Even WebView
theme propagation and simultaneous two-device telemetry are not proven. If the bridge
supplies only one reading, do not advertise simultaneous R1/G2 battery readings. Unknown
values are intentionally unavailable. That limitation can be disclosed without blocking
release of the rest of the app.

### P1: first-run explanation, privacy and BYOK cost clarity

Key masking, deletion, local conversation/history deletion, estimated cost and an
unpriced-usage warning already exist. The visible key explanation primarily says it is
stored locally. README explains external services, but there is no dedicated
privacy/onboarding surface found in the phone app sources.

Before first voice use, explain that voice and text are sent to OpenAI. Explain that the
user supplies a paid API account. State that the displayed cost can be incomplete
because dual transcription has unpriced events. Show where to stop listening. Show where
to delete keys and history. Keep the relevant microphone state visible. Publish a
privacy policy covering every manifest permission, local retention/deletion, actual
external providers, and developer contact. Verify the portal's policy URL and metadata.
The portal listing fields were not inspected in this session. Their completeness at this
checkpoint is unknown. The guide forbids bundling secrets. Runtime user-supplied BYOK is
not automatically assumed rejected by this assessment.

### P1: public service operations and attribution

The packaged app depends on the shared public Worker for maps/news/routing. Its source
has bounded requests, upstream timeouts and cache headers, but no application
rate-limit/admission binding in worker/api.js or wrangler.api.jsonc. Establish request
limits, usage/error monitoring and a budget response before broad traffic. No production
load test, account quota inspection, or Cloudflare rule audit was run. External WAF
rules may exist beyond this repository.

Verify provider terms for the intended distribution/monetization model. Open-Meteo free
usage is non-commercial, limited, and carries no uptime guarantee. Public availability
is not inherently commercial use. Add visible weather/geocoding attribution where
required (Open-Meteo/GeoNames). Map attribution already exists. Official product-photo
provenance is recorded. Before using store assets, confirm redistribution permission.
Public CDN availability does not establish a license.

### P1: store materials and release claims

Prepare matching grayscale foreground/background icons, actual simulator screenshots,
privacy/developer/permission details, and release notes for the eight languages in
app.json. Check that the first-run setup message is visible on glasses without an OpenAI
key or location access. State the key and optional ORS prerequisites in the listing.
Remove stale unpublished/development claims at the actual release stage. At this
checkpoint, README and phone footer still describe an unpublished prototype. Newly added
small HUD and theme labels use English fallback outside Korean and Japanese. Either
complete the claimed locales or accurately describe supported coverage. No listing text
was posted or edited during this review.

## Defer until after a stable first release

Do not delay the first release for new dashboard features, longer Conversate memory, or
extra integrations. Unsupported brightness control and simultaneous device telemetry
also remain outside this release. The current SDK path does not expose those controls or
readings. Prefer the compliant exit flow, first-run clarity, production operations and a
small physical beta round first.

## Primary references

- Official reviewer checklist (updated 2026-10-09): https://hub.evenrealities.com/docs/ship/app-submission
- Official beta distribution workflow: https://hub.evenrealities.com/docs/cli
- Primary, still-open exit-dialog image-channel issue report: https://github.com/even-realities/everything-evenhub/issues/18
- Provider terms and capacity/availability conditions: https://open-meteo.com/en/terms https://open-meteo.com/en/pricing

Review ended without changing production code, promoting Beta/Public, submitting review,
inviting testers, or publishing new listing/privacy text.
