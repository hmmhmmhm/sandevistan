# Main integration checkpoint — November 10, 2026

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

The GitHub default branch was still at `7d68cb9` (August 7). Recent maintenance and
v0.2.7 release work existed as local uncommitted changes on `main`. A fetch and
GitHub branch readback confirmed the same remote head. The repository is public. No
feature branch or worktree was created for this integration.

## Included changes

- SDK 0.0.16, CLI 0.2.0, simulator 0.9.5 and the reviewed dependency lockfile.
- Four-tile AI screens, hold-to-speak Ask AI, dual transcription, bounded response
  lifecycle and cancellation, answer-position scrolling and weather tools.
- Cumulative Conversate captions, paired translations, cue countdowns and history.
- Phone Auto/Light/Dark themes, smaller Home device imagery and battery telemetry.
- Key setup guidance, root Hide/Exit/Return menu, public-build network restrictions,
  locale copy, the public API Worker and release/verification harnesses.
- v0.2.7 release metadata: Even Hub In review, not publicly approved or published.

Historical reproduction, rendering and transport experiment branches are preserved. They
are not merged wholesale into the approved runtime. Several deliberately pin older SDKs
or alternate rendering contracts. At this checkpoint, current source remains on main.

## Privacy and recovery

A recoverable patch and untracked-source archive were saved outside the repository
before staging. Local output captures, audio, browser records and packages remain
excluded from Git. Environment files are ignored except the checked-in public-origin
`.env.evenhub` and an optional example. That build configuration contains no key. A scan of
candidate text found no real credential patterns. Key-shaped test fixtures are
explicitly marked as tests. The release record omits the personal telephone and postal
address. Historical output evidence paths refer to local captures. Those files are not
promised to be available from a public clone.

## Verification

- Main and simulator TypeScript checks passed.
- Vitest: 107 files / 789 tests passed with Node 22.23.2.
- Node server/repository suite: 642 tests passed. Seven repository-rule tests passed.
- General web, Even Hub and API Worker builds passed.
- The generated Sites artifact passed its focused Worker checks.
- Installed root dependencies matched the manifest. No missing root packages.
- Independent read-only review found no integration blocker. README minimum Node and
  packaged-versus-local map provider descriptions were corrected.

The initial full Vitest run under Node 25.9.0 was interrupted after it stopped reporting
progress. A focused test passed under both Node 22 and Node 25. The full-suite delay
cause was not established. No application fix is inferred. The verified full-suite
environment is Node 22.23.2. Existing large-bundle warnings remain. Current-SDK physical
G2 regression checks and account billing alerts remain pending. This Git integration is
not evidence that they passed.

GitHub publication of the final commit message requires the owner's draft approval. No
force push or historical branch deletion is part of this work.
