# SDK compatibility

The v0.2.8 candidate pins SDK `0.0.16` and requires Even app `2.2.10` or later.
Current-SDK physical G2 regression checks remain pending.

| SDK | Recorded physical result | Scope |
| --- | --- | --- |
| `0.0.16` | No new full physical regression pass recorded | Current candidate |
| `0.0.11` | Four-tile transport passed | Historical fallback at `7d68cb9` |
| `0.0.12` | The earlier host failed on compressed image updates | Historical reproduction |
| `0.0.13` | Bilateral checkpoints passed. Later compression failures were intermittent | Comparison record |

The `compressMode: 2` path started in SDK `0.0.12`.
A later Even app and firmware combination passed some SDK `0.0.13` checkpoints.
Intermittent failures then caused a return to `0.0.11`.
The `0.0.16` candidate retains SDK compression, typed bytes and the bounded four-call transport.
Those choices do not prove that the old intermittent failure is fixed.

The unchanged [0.0.12 reproduction branch](https://github.com/hmmhmmhm/sandevistan/tree/0.0.12-reproduce)
remains available for the Even Realities team. It is not the current app.

## Evidence records

- [First successful image transfer](../hardware/2026-07-26-first-g2-image-success.md).
- [SDK 0.0.11 checkpoint](../hardware/2026-07-27-sdk-0011-transport-success.md).
- [SDK 0.0.12 experiment](../hardware/2026-07-28-sdk-0012-lz4-experiment.md).
- [SDK 0.0.13 checkpoint](../hardware/2026-07-31-sdk-0013-image-transport.md).
- [Unchanged-tile comparison](../hardware/2026-07-28-g2-unchanged-tile-skip.md).
- [November SDK audit](../maintenance/2026-11-08-sdk-audit.md).

Historical readiness and completion audits state the evidence available on their dates.
They do not approve a later SDK or a later store submission.
