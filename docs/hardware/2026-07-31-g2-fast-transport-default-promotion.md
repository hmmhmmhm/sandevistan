# G2 Fast Transport Default Promotion

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-31

Status: PASS — integrated into `main`

Branch: `experiment/g2-pipelined-transport`

## Goal

Validate the query-free fast route after promoting the physically measured
four-call SDK pipeline and four-level content palette to defaults. Confirm that
solid-black hide frames now bypass palette conversion without changing the
proven no-queue, fail-fast transport behavior.

## Default

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&build=fast-default-040
```

Missing or invalid performance parameters resolve to four in-flight image
calls and the `hud-4` transmitted palette.

## Rollback

```text
http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.11&pipeline=1&levels=original&build=rollback-serial-original-040
```

This route selects serial transport and the original palette without changing source or SDK version.

## Prior physical evidence

The preceding palette comparison on the same four-call pipeline recorded:

| Metric | Original palette | Four-level palette | Change |
| --- | ---: | ---: | ---: |
| Full HUD PNG bytes | 50,031 | 22,821 median | 54.4% lower |
| Complete restore | 2,468 ms median, n=4 | 1,855 ms median, n=8 | 24.8% faster |

No `sendFailed` or timeout appeared in the supplied comparison trace. The generated black frame remained 4,704 bytes in both modes. This revision sends that frame through the original encoder without the redundant palette pass.

## Required physical evidence

Run only one route at a time. On the default route:

1. Confirm startup renders all four quadrants in both eyes.
2. Repeat at least five hide and restore cycles.
3. Confirm content encodes report `palette hud-4`.
4. Confirm hide encodes report `palette original`.
5. Confirm each four-tile refresh starts with up to four in-flight SDK calls.
6. Record content and black PNG byte totals plus complete-refresh durations.
7. Confirm clock, weather, map labels, news body, and TODO text remain legible.
8. Record any missing tile, persistent tearing, timeout, or `sendFailed`.
9. Leave the WebView idle, then confirm double-tap and scroll remain responsive.
10. Confirm input received while busy is dropped and is not replayed later.

The default route must preserve binocular output, correct content, and reliable hide and restore. No queue may accumulate. Input must remain responsive after idle.

## Physical result

The owner completed the default-route G2 check on 2026-07-31 and confirmed the
requested interaction sequence. The supplied trace excerpt records four hides and three restores. It ends during the fourth hidden state. The owner's completion confirmation covers the full physical run.

### Default selection and startup

- Startup resolved `pipeline 4 · palette hud-4` without performance query
  parameters.
- The initial four-tile content encode was 12,965 bytes and completed in
  1,086 ms.
- IDs `3`, `5`, `2`, and `4` all started with in-flight counts one through
  four before the first completion.
- All four tile calls succeeded.

### Hidden-frame bypass

| Metric | Recorded result |
| --- | ---: |
| Hidden payload | 4,704 bytes on every recorded hide |
| Hidden encode | 24 ms median, n=4 |
| Hidden complete refresh | 362 ms median, n=4 |
| Hidden palette diagnostic | `palette original` |

The bypass removed the earlier roughly 100 ms four-level encode pass while
retaining the same minimal black PNG payload.

### Content restore

| Metric | Recorded result |
| --- | ---: |
| Restored payload | 22,737 bytes on every recorded restore |
| Restore encode | 89 ms median, n=3 |
| Restore complete refresh | 2,065 ms median, n=3 |
| Restore palette diagnostic | `palette hud-4` |

Every restored tile succeeded. No `sendFailed`, timeout, retry, deferred
operation, or queued replay appears in the trace. Live requests received while
the transport was busy were dropped immediately, and an identical right-side
refresh skipped both unchanged tiles.

### Visual and interaction confirmation

The owner's completion response confirms the requested binocular, four-tile,
hide/restore, and responsiveness check. No visual regression, missing tile, or
input freeze was reported.

## Decision

The query-free default passes the physical gate. Promote the branch to `main`
by fast-forward, rerun the complete serial verification suite on integrated
`main`, and retain the experiment branch and explicit serial/original rollback.

## Automated gate

- Vitest: 57 files, 511 tests passed serially.
- TypeScript: passed.
- Repository copy checks: 5 passed serially.
- Production and Sites builds: passed.
- Sites worker tests: 4 passed serially.
- Even Hub package: `sandevistan.ehpk`, SDK `0.0.11`.

## Main integration

`main` was fast-forwarded through physical-pass commit
`dded1e734316e542eeb13afb8a3a1455297c0c01` on 2026-07-31. The integrated
branch then passed:

- 57 Vitest files and 511 tests with one worker and no file parallelism;
- TypeScript;
- 5 repository-policy tests and the repository copy check;
- the production and Sites builds;
- 4 Sites worker tests;
- all 147 Node tests with concurrency one;
- the client ORS secret scan; and
- Even Hub packaging at 1,773,055 bytes.

The integrated package SHA-256 is:

```text
69aaf65a85a49257575d57116737ebb1a7cb549f274e05ece35f9b4b26bafd8f
```

## Integration rule

The physical gate and integrated `main` verification are recorded above. Keep
the experiment branch and explicit rollback available as historical evidence.
