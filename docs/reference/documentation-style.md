# Documentation writing rules

This project uses ASD-STE100 principles to make technical records clear.
The target is short, precise English with consistent technical names.
This profile does not claim full dictionary validation or formal STE certification.

The official [ASD-STE100 overview](https://www.asd-ste100.org/about_STE.html) describes the writing rules and controlled dictionary.
The [official FAQ](https://www.asd-ste100.org/STE_faq.html) identifies the current issue and maintenance process.

## Sentence rules

- Give each sentence one main thought.
- Give each procedural sentence one instruction.
- Put the condition before the action.
- State the actor when the actor is known.
- Use the same term for the same item.
- Use direct verbs such as start, stop, send, save and check.
- Use a maximum target of 20 words in an instruction and 25 in a description.
- Keep technical identifiers exact. Do not paraphrase symbols or commands.
- Keep articles such as the and a when they prevent ambiguity.
- Do not use an instruction as evidence that someone completed the instruction.

A word-count tool cannot approve technical meaning or dictionary use.
Review sentence structure, vocabulary and evidence together.

## Document types

| Type | Required content |
| --- | --- |
| Current guide | Current behavior, conditions, action and expected result |
| Experiment record | Purpose, tested configuration, method, observation, conclusion and limits |
| Historical specification | Proposed behavior, constraints and unresolved decisions |
| Historical implementation plan | Intended steps and acceptance criteria, without implied completion |
| Release record | Package identity, checks, approval and observed portal state |

## Evidence rules

Preserve code blocks, identifiers, commands, values, versions, units and source links during editorial changes.
Do not change a failed result into a pass.
Do not change a simulator result into a physical-device result.
State the measured interval and tested configuration with each performance result.
Keep hypotheses separate from observations.

Dated records describe their original checkpoints.
Use the current guides for current behavior.
Do not execute old branch, worktree or deployment commands merely because a historical plan contains them.
The current repository workflow uses `main`.

## Technical terms

| Term | Project meaning |
| --- | --- |
| HUD | The glasses display |
| Frame | One 576×288 Canvas image |
| Tile | One 288×144 image sent to an SDK image container |
| Image acknowledgement | The SDK completion result. It is not proof of optical display output |
| Caption | Text recognized from speech |
| Final caption | Refined text that supplies the Ask AI request |
| Inform | A contextual information cue in Conversate |
| Copilot | Suggested replies in Conversate |
| Cue history | Retained local Inform and Copilot records |
| Local evidence | Private output files excluded from the public Git tree |
| Origin | A URL scheme, host and optional port, without a path |
| Physical check | A check on actual glasses, phone and relevant controls |

Product names, API names and code identifiers are technical names in this profile.
The table does not claim that these words are entries in the STE dictionary.

## Editorial verification

Run `npm run test:docs` to check local links and the README size.
For an editorial-only revision, use `node scripts/check-docs.mjs --base <commit>`.
The comparison also checks original code, numbers, headings and link targets.
Intentional technical changes need a separate review. Do not hide them as editorial changes.
