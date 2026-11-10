# Documentation review checkpoint

The documentation revision follows the November 10 v0.2.8 resubmission.
It changes documentation and verification commands, not the submitted application bundle.

## Scope

The README changed from 526 lines to 66 lines.
Seven focused guides now contain the product, AI, data, development, transport, compatibility and privacy details.
The [documentation index](../index.md) separates current guides from dated records.
The [record catalog](../records.md) retains the original paths and titles.

The editorial pass covered 179 dated research, hardware, maintenance, design, specification and implementation-plan records.
The language-extension guide also received a current catalog description.
Approved listing and privacy copy remained outside the editorial rewrite.

## Writing changes

- Added explicit historical scope to dated records.
- Split dense prose and multi-action instructions.
- Named actors and put conditions before actions.
- Repaired malformed translated paragraphs and checklists.
- Preserved failed, pending and unverified conclusions.
- Added public notes where the original records contain unresolved contradictions.

The [writing rules](documentation-style.md) define the project profile.
This pass applies STE principles. It is not full controlled-dictionary certification.

## Preservation checks

The comparison baseline is commit `ed63908`.
The baseline contains 187 documents and 1326 fenced code blocks.
All original code blocks, inline-code tokens, numeric tokens, link targets and headings remained present.
These mechanical checks do not replace review of technical meaning.

Run the comparison with:

```bash
node scripts/check-docs.mjs --base ed63908
```

Run current structural checks with:

```bash
npm run test:docs
npm run test:repo
```

The current check covers local links, heading anchors and README size.
Positive and negative fixtures confirmed missing-target, missing-anchor and oversized-README failures.
External URLs and private evidence files are not fetched.
Paragraph word counts exclude lists, tables, quotations and code.
Four longer paragraph items remain in retained publication or legal drafts outside the research-editing scope.

## Independent review

The review compared current gestures with the reducer and transport.
It corrected map zoom direction and the News detail single-tap description in the product guide.
Historical samples retained their date, version and evidence limits.
The source ambiguities remain explicit rather than being resolved through editorial assumptions.

The v0.2.8 portal evidence records In review at submission.
Physical G2 regression checks remain pending.
