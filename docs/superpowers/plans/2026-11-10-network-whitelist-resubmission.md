# Network whitelist resubmission plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

The owner requested correction of the v0.2.7 rejection, resubmission, and a
mandatory pre-deployment whitelist checklist. Work stays on main.

## Design and scope

The reviewer reported two bundled RSS URLs and the OpenAI key-issuance link
missing from app.json. Built-in RSS still flows through the fixed API Worker.
Listing metadata origins does not change request routing.
Declare every embedded product URL origin, including provider setup and attribution links.
Use exact secure origins as required by the official networking guide.
Do not hide, encode, or remove useful URLs to evade review.
Use the existing Iconify offline renderer for already bundled icon objects.
Remove its unused remote API fallback. Preserve the icons.

## Implementation sequence

1. Add a bundle audit and regression tests. Parse JavaScript string/template
   literals plus HTML/CSS; require every embedded HTTP/WebSocket origin in the
   network whitelist. Exempt only exact standard XML namespace identifiers.
   Reject insecure, duplicate or non-origin whitelist entries; fail on missing
   build inputs. Dynamic runtime destinations are outside static proof and
   must continue through fixed-origin handlers.
2. Wire the check after build:evenhub and before the official pack command.
   Add reviewed origins, update app version to 0.2.8, and use offline icons.
3. Make the release checklist mandatory in AGENTS.md and document commands,
   evidence hashes, permissions, secrets, API and physical-device limitations.
4. Run focused audit tests, actual negative/positive bundle checks, icon tests,
   type/repository checks and packaging. Preserve the prior package.
5. Prepare the exact changelog and concrete package for owner draft approval,
   then upload the approved build and submit for Public review. Preserve the
   approved store assets/listing. Do not assert unperformed hardware checks.

Official reference: https://hub.evenrealities.com/docs/build/networking
