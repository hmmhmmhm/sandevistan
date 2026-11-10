# Private build 0.2.6 preparation

The owner requested deployment of the approved phone themes and smaller Home
product imagery. Version was advanced from 0.2.5 to 0.2.6 on main. The previous
published package is preserved at output/release-025-2026-11-09/sandevistan-0.2.5.ehpk.

The official packer produced the new sandevistan.ehpk. Exact size, hash and proposed
changelog are in ../releases/2026-11-09-private-build-026.json. Build and repository
checks passed; the production client contains both local product images and no
project-key prefix. The implementation's full 772-test suite and both typechecks
passed before this version-only release change; 19 release metadata, companion
and theme cases passed again after the version update. Visual and telemetry
limitations are documented in 2026-11-09-phone-theme-implementation.md.

The package is ready. No upload has been performed; final changelog approval is
pending under the owner's external-post draft rule. Browser work will use the
updated Safari independent-window policy and a unique task-owned session.

The owner approved the exact changelog. Publication remains incomplete because
the official CLI is unauthenticated and Safari reached the Even Hub login page.
No authentication data was extracted, entered or copied. The dedicated Safari
window 56219 was closed successfully with stop. Await user login or explicit
permission to reuse the existing Chrome session for this deployment. Do not
request the approved changelog again.

Publication completed after the owner explicitly permitted the existing Chrome
session for this deployment. Verified v0.2.6, Private visibility and the exact
approved changelog in Build details. Evidence:
output/release-026-2026-11-09/evenhub-confirmed.txt. Task session dadv was stopped;
the browser session inventory was empty. Earlier authentication notes are historical.
