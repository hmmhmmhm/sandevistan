# Public release preparation

Owner request: prepare all remaining release work, show glasses-side setup guidance
when a required key is missing, especially X/Twitter; translate remaining messages;
prepare icons and store screenshots for owner review. Do not deploy or submit.

## Acceptance and scope

A reviewable release candidate must have a valid package, passing checks, visible
setup guidance without a key, compatible root exit behavior, localized release
copy, bundled privacy/help content, operational controls, store asset drafts and
an explicit owner-review packet. Physical locked-phone acceptance and asset/text
approval are separate pending gates, not silently passed. Preserve main-only work,
existing user changes, and the four-tile glasses transport. No commits or external
publication. No feature or account credentials are bundled or logged.

## Sequential work list

- [x] Read the poteto-mode Principles section and applicable TypeScript guidance.
- [x] Ground scope in current source and the public-readiness review.
- [ ] Capture baseline keyless flows and translation coverage.
- [ ] Resolve X scope: no current X feature exists in this repository; owner asked.
- [ ] Show new setup/exit guidance and icon concepts for approval before wiring UI.
- [ ] Implement approved setup/exit flow; verify cancellation and microphone cleanup.
- [ ] Translate missing messages and add a repeatable coverage check.
- [ ] Prepare privacy/onboarding/provider attribution and exact store-copy drafts.
- [ ] Add bounded public Worker admission/monitoring preparation without deploying.
- [ ] Produce actual simulator screenshots, separate from icon/design concepts.
- [ ] Run relevant behavior, API, type, repository and build/package checks.
- [ ] Review decision trail sequentially with an independent reviewer.
- [ ] Hand back owner review packet and physical-beta checklist; await deploy request.

## Review checkpoints

The existing HUD is the visual reference. New setup states explain how to open
the phone web app and find the provider's issuance/registration control. Root exit
must lead to the system confirmation, preserving detail Back navigation and a
separate display-hide action if approved. Icons must be original monochrome
foreground/background assets; no existing game or manufacturer logo is copied.

Functional code changes remain local. Privacy/listing/changelog drafts require
explicit approval before any external posting. The owner has not authorized
Public submission by requesting preparation. X work is dependent on the pending
clarification; all independent work continues.

Decision trail: output/public-release-prep-2026-11-09/work/decisions.tsv.
