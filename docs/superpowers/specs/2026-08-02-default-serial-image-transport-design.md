# Default Serial Image Transport Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Status: Rejected after physical G2 testing. Pipeline one remains an explicit
diagnostic, while the query-free route uses pipeline four.

## Goal

Make the production HUD transport send one image update at a time by default.
This reduces concurrent SDK calls while preserving explicit transport
experiments.

## Behavior

- A route without a `pipeline` query parameter uses concurrency `1`.
- An invalid `pipeline` value also falls back to concurrency `1`.
- Explicit `pipeline=2`, `pipeline=3`, and `pipeline=4` values remain available
  for controlled experiments.
- Full-screen refreshes keep the established tile order: right-top (3),
  right-bottom (5), left-top (2), then left-bottom (4).
- Partial two-tile refreshes use the same serial limit.
- Unchanged tiles remain skipped.
- Ask AI exit keeps its 200 ms image-page readiness barrier before the first
  image send.
- Failed sends remain failures. The change does not add retries, queued work,
  or forced resends.

## Implementation Boundary

Change only the default resolution in `image-send-concurrency.ts` and the tests and durable documentation that define it.
Keep the bounded task pool and image transport unchanged.
They already enforce a limit of one correctly.

## Verification

- A resolver test must fail under the old default of `4`, then pass with `1`.
- App integration tests must prove the production route receives concurrency
  `1` and explicit pipeline values still pass through.
- Transport tests must continue proving that concurrency `1` never has more
  than one image call in flight.
- Run the complete test, type, repository, Sites, and package verification
  gates before deployment.
