# Public API release operations

Status: deployed November 9, 2026. Production version
`579dc215-137c-438c-b6ce-62fc97c3f722` serves 100% of traffic.
Rollback version: `12411f36-751a-41b7-b40b-fbae33db73d7`.
Only the API Worker was deployed; Sites and the X relay were untouched.

The release configuration adds a native rate-limit binding (120 requests per
60 seconds per connecting IP) and fails closed when that required binding is
missing. CORS preflight remains available. A 429 response includes Retry-After:
60. The health endpoint reports 503 when the service is disabled or a required
binding is missing. It does not perform upstream probes.

Cloudflare rate limiting is approximate and local to each Cloudflare location;
it is not a strict global budget. See the [official binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
Production namespace is `2026110901`; the prior API version had no bindings.
Account-wide namespace uniqueness across unrelated Workers was not audited.
A shared namespace would share counters. Analytics Engine dataset
`sandevistan_public_api` is active and received events.

The optional Analytics Engine binding records only fixed endpoint path, HTTP
status, and a count. It does not record query strings, coordinates, request
bodies, keys, or IP addresses. Provider network metadata remains subject to
Cloudflare's own policies. Metrics failures do not fail API requests.

## Deployment gate

1. Review and approve the application release, API changes, and public copy.
2. Run API tests and `npm run build:api`.
3. Deploy only `wrangler.api.jsonc`; preserve the separate X relay and Sites Worker.
4. Check health, one RSS request, map, geocoding, optional user-key routing,
   CORS preflight, and deliberate rate-limit behavior against the deployed Worker.
5. Confirm events arrive without sensitive values. Review status ratios and
   request volume before enabling a public listing.
6. Verify Open-Meteo's current usage terms match the intended distribution and
   that attribution is visible. Public distribution alone does not establish a
   commercial API entitlement.

## Incidents and budgets

Use `PUBLIC_API_ENABLED=false` to stop upstream requests without removing CORS.
Keep `REQUIRE_PUBLIC_API_LIMITER=true` in production. Redeploying the previous
Worker is the rollback; preserve its artifact before deployment.

Before launch, the account owner must configure account usage/billing alerts and
an operational destination. No billing alerts or notification destinations have
been created by this preparation. Review 429 and 5xx rates, provider quotas, and
Cloudflare usage daily during the initial rollout. A per-IP limit does not cap
aggregate spend or prevent distributed abuse. A hard global budget would need
a separate globally coordinated control; it is not implemented here.

## November 9 deployment verification

Seven production live checks passed: health, privacy, replacement RSS, New York
map, London map, CORS preflight and missing-key routing behavior. Map responses
were validated with the production client parser. A real upstream user-key route
was not exercised. Evidence: `output/public-release-prep-2026-11-09/work/api-after-refresh.json`.

An initial production threshold probe was inconclusive: serial requests crossed
time windows and edge locations. An isolated immutable preview with a separate
namespace and limit 2/60 seconds returned the expected Worker 429 and Retry-After
60. This verifies native binding integration, not a strict global production
threshold. Diagnostic version `28e9d36b-7c8f-4659-87aa-2fe1f4b5eff4` was uploaded
only and must never be deployed to production. Production remained on the version
above at 120/60 seconds. Evidence: `api-rate-preview-result.json` and
`api-deployment-after-preview.txt` in the same work directory.

Twenty-three focused API/map tests and the API build passed before deployment.
The Analytics Engine dataset list showed events arriving; source/tests establish
the fixed custom event schema, while raw event rows were not inspected.
