# Mandatory Even Hub pre-deployment checklist

Run this checklist for every new build or review resubmission. Do not upload an
old package after changing app.json: permissions live in the packaged manifest.
Do not bypass a failing command, silently add wildcard permissions, or treat a
simulator result as physical-device evidence.

## Automated gate

Run `npm run release:check` with the documented Node 22 environment. It runs both
TypeScript checks, repository checks, app and server tests, fresh Even Hub packing
and the API build. `npm run pack` independently enforces the network audit after
building the production client and before official packaging. A missing origin
or invalid whitelist entry stops packaging with a nonzero exit status.

- [ ] All commands pass; retain their logs for this exact candidate.
- [ ] Audit the actual client with `npm run check:evenhub-network`.
- [ ] Review every newly embedded origin: APIs, WebSockets, built-in feed metadata,
      provider key pages, attribution links and library URLs. Exact HTTPS/WSS
      origins only; HTTP, wildcards, paths and duplicates are rejected.
- [ ] Keep RSS/routing requests on their fixed Worker handlers. Permission
      declarations do not replace CORS or justify bypassing those handlers.
- [ ] XML namespace identifiers are the only static-audit exemption. A new library
      network fallback must be removed when unused or explicitly reviewed.

The audit parses built JS literals/templates and scans HTML/CSS. It cannot prove
arbitrary runtime-generated destinations or redirects. Custom feeds remain
proxied; arbitrary-origin MCP stays disabled in the public build. Review dynamic
request paths and provider redirects separately. Do not encode URLs to evade it.

## Candidate and operational review

- [ ] Confirm main, intended app version, SDK and minimum Even app version.
- [ ] Review final diff and dependencies; scan source/package for real credentials,
      private contact details, transcripts and test-only assets.
- [ ] Preserve the prior package; record candidate size and SHA-256 after packing.
- [ ] Confirm the packed manifest and client match the checked inputs. Any source,
      environment or manifest change requires rebuilding and repeating the audit.
- [ ] Verify required live API health, RSS, map, CORS and missing-key behavior.
      Record optional routing/AI checks that were not run; do not imply a pass.
- [ ] Verify missing-key guidance, provider links, root Hide/Exit/Return and detail
      Back. Check microphone/session cleanup when relevant code changes.
- [ ] Record physical G2 lock/recovery, reconnect and exit-confirmation checks.
      Mark unperformed checks as pending and disclose them; never attest a pass.
- [ ] Confirm permissions, privacy text, attribution, contact details and approved
      store screenshots still match actual behavior.
- [ ] Obtain the owner's approval of final external changelog/listing/commit copy.
- [ ] Upload the exact checked package; verify version/size in the portal, select
      it for Public review and retain the resulting review-state evidence.

Reference: [Even Hub networking guide](https://hub.evenrealities.com/docs/build/networking).
It requires one full origin per entry and states that whitelist permission does
not bypass browser CORS.
