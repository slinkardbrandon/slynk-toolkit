# Shared voice snippet + output caps

> Spec session -- 2026-10-07
> Source: handoff `/tmp/slynk/handoff/handoff-2026-10-06-shared-voice-snippet.md` (ephemeral)

## Summary

One voice snippet in `lib/voice.md`, expanded by the installer into every slynk SKILL.md via `{{SLYNK_VOICE}}`. It has a Chat block (length caps) and an Artifact block (tone and structure). Also: a slimmer spec plan format, terser buildability-gate reports, and spec-review checking artifact voice.

## Key Decisions

- Two blocks, Chat + Artifact: not every consumer defines tone, so specs would vary by machine.
- slynk voice wins inside slynk artifacts (spec, handoff, seed, PR body): an opinionated format keeps specs consistent and reviewable.
- Repo conventions shape content (naming, patterns, test style), not voice: keeps the guarantee across repos.
- A repo PR template sets PR sections; our voice fills them: `create-pr` already follows templates (`skills/create-pr/SKILL.md` Step 7).
- No em-dash rule in the snippet: that's Brandon's personal preference, not a slynk rule.
- Install-time expansion, not a runtime read: zero tool calls, plain markdown on all four runtimes.
- Hand-placed token under `## Voice` in each source SKILL.md: explicit, greppable, opt-out by omission.
- All five skills carry it; no guard test: not worth it yet.
- Snippet lives at `lib/voice.md`, not a shared lib: only the installer reads it. `lib` is already in `package.json` `files`, so it ships via npx with no change.
- No quoted example phrases in snippet rules: agents copy them verbatim.
- Precedence line binds to the host skill and covers templates, caps, and built-in prompts: snippet text only exists inside a loaded skill; offers like spec-review's revise prompt must survive "no follow-up offers".
- Existing skill-specific templates (Summary "2-3 sentences", spec Phase 2 caps table, brainstorm diagram/summary rules) stay: precedence resolves them.
- Phase 4 plan stays inline in chat: review happens in the terminal or not at all.
- Gate report: blockers first, nits last and shorter, expand on request: terse without hiding.
- Re-review rounds report only the delta, in spec 5b and standalone spec-review: re-listing every finding made the walls.
- spec-review's tone rubric becomes the Artifact block everywhere it is named: consistent drift check on every gate pass.
- Voice findings are nits; contradictory duplication blocks: keeps BLOCKED meaning buildability.
- No per-turn consumer hook: forced ceremony (see `CONTEXT.md` Ceremony).

## Terms Clarified

- **Voice snippet**: the shared Chat + Artifact rules in `lib/voice.md`, expanded into each SKILL.md at `{{SLYNK_VOICE}}`.
  _Avoid_: "tone file", "style guide" (AGENTS.md Tone is this repo's, not shipped).

## Test Cases

`renderSkill` describe:

- expands `{{SLYNK_VOICE}}` to the given `voice` string
- renders a body without the token unchanged
- leaves the token untouched when `voice` is not passed
- inserts a `voice` containing `$&` or `$$` literally

New `describe("voice expansion")` with its own `makeVoiceFixture()` (don't extend `makeFixtureSkills`): one `demo` skill whose SKILL.md is `---\nname: demo\n---\n\n## Voice\n\n{{SLYNK_VOICE}}\n`, plus a scratch voice file `\n\nVOICE-LINE-1\nVOICE-LINE-2\n\n` passed as `voiceSource`:

- leaves no literal `{{SLYNK_VOICE}}` in installed SKILL.md, copy and link mode
- writes `## Voice\n\nVOICE-LINE-1\nVOICE-LINE-2\n` (snippet trimmed)
- normalizes a CRLF variant of the voice file to LF in the installed SKILL.md
- defaults `voiceSource` to the real `lib/voice.md` (installed text contains "State each fact once")

Existing installer tests still pass.

## Implementation Plan

### What we're building

The voice snippet and its installer expansion; placement and rule folds in all five skills; slimmer spec Phase 3 format; terser 5b and spec-review reports; spec-review's rubric repoint; glossary, AGENTS.md, review-doc, and changelog updates.

### Approach

1. Write `lib/voice.md` with the exact text below.
2. Expand `{{SLYNK_VOICE}}` in `renderSkill`; read the snippet in `install()` via an injectable `voiceSource`.
3. Add `## Voice` + token to all five SKILL.md files and apply the listed folds.
4. Slim spec Phase 3, rewrite report rules in spec 5b and spec-review, repoint spec-review's rubric.
5. Update glossary, AGENTS.md, review docs, and changelog.

Quoted "from" strings below are reflowed to one line; source files hard-wrap some of them, so match ignoring line breaks and re-wrap to the file's width.

### Snippet text (`lib/voice.md`, exact)

```markdown
This skill's own templates, caps, and built-in prompts (offers, approvals) override these defaults.

**Chat**

- Answer first. No greeting, no preamble, no recap, no follow-up offers.
- Answer only what was asked: no unrequested background, lists, examples, walkthroughs.
- One idea per sentence, ~20 words max, active voice. Default total ~100 words.
- Code, commands, paths, errors, and numbers stay exact.
- Quiet tool runs: one line per phase, one line with the result.
- Decided things: one line plus a pointer (PR, spec, date).
- Full sentences for security warnings, irreversible actions, and step-by-step orders.

**Artifacts** (specs, handoff docs, seeds, PR bodies; this voice wins over repo tone)

- One idea per bullet. Bullets over paragraphs, tables for comparisons.
- No paragraph over 2 sentences.
- Decisions: one line plus a one-line rationale.
- Reference other artifacts by path; don't restate them.
- State each fact once, in one section.
- No fluff, hedging, or preamble.
- Repo conventions shape content (naming, patterns), not this voice. A repo template sets sections; this voice fills them.
```

### Files to touch

**`lib/voice.md`**: new; text above.

**`lib/installer.mjs`**

- Add `const VOICE_TOKEN = "{{SLYNK_VOICE}}";` beside `TOKEN`.
- Add `const DEFAULT_VOICE_SOURCE = fileURLToPath(new URL("voice.md", import.meta.url));` (installer and snippet share `lib/`). Import `fileURLToPath` from `node:url` (pattern: `bin/slynk-toolkit.mjs:21`).
- `renderSkill(content, { slynkDir, name, voice })`: when `voice` is a string, `out = out.replaceAll(VOICE_TOKEN, () => voice)` (function replacer keeps `$` literal). When `voice` is undefined, leave the token untouched. Run before the `{{SLYNK_DIR}}` replace.
- `install({ skillsSource, runtimes, mode, hookSource, voiceSource = DEFAULT_VOICE_SOURCE })`: read once, `readFileSync(voiceSource, "utf8").replaceAll("\r\n", "\n").trim()`, pass as `voice` to every `renderSkill` call. A missing `voiceSource` throws and aborts the install (intended: the default ships in `lib`). Injectable like `skillsSource`/`hookSource` so tests drive it.
- Header comment (`:6`): "Two mechanical substitutions happen per SKILL.md" becomes "Three mechanical substitutions happen per SKILL.md"; add item `//   3. {{SLYNK_VOICE}} -> the shared voice snippet (lib/voice.md).`
- `install()` comment: "SKILL.md edits still need a re-run." becomes "SKILL.md and lib/voice.md edits still need a re-run."
- `renderSkill` comment (`:37`): "Apply the two substitutions" becomes "Apply the three substitutions".

**Voice placement**: insert exactly `## Voice\n\n{{SLYNK_VOICE}}\n\n`:

| Skill                               | Spot                                                      |
| ----------------------------------- | --------------------------------------------------------- |
| `spec`, `brainstorm`, `spec-review` | first thing inside `<supporting-info>`, above `## Inputs` |
| `create-pr`                         | directly above `## Overview`                              |
| `handoff`                           | directly above `## Step 1 -- Gather Context`              |

**Rule folds** (the full list; nothing else in these sections changes):

| Where                                                  | Change                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/brainstorm/SKILL.md` Rules, "Skimmable" bullet | "Comparisons as tables, diagrams as mermaid/ASCII, summaries <= 7 one-line bullets, no prose block over 3 sentences." becomes "Diagrams as mermaid/ASCII, summaries <= 7 one-line bullets, no prose block over 3 sentences." (tables already covered at `:165`) |
| `skills/create-pr/SKILL.md` Step 7 `**Tone:**`         | delete "no bullet-point breakdowns of obvious things, " (keep "No em-dashes." and the rest)                                                                                                                                                                     |
| `skills/handoff/SKILL.md` Step 3 opening               | "Write for an AI agent that has NO prior context. Short declarative sentences. State facts and next actions, no hedging." becomes "Write for an AI agent that has NO prior context. State facts and next actions."                                              |
| `skills/spec/SKILL.md` Behavioral Rules #2             | append to the bullet: "Voice stays this skill's (see Voice), whatever the repo's tone."                                                                                                                                                                         |

**`skills/spec/SKILL.md` Phase 3**: add this line directly above the "### Plan format:" heading: "List items are one line. Omit empty sections. Approach max 5 steps. Target ~40 lines." Delete the "### Patterns to follow" section (heading + its two bullets) from the format; in the Files to touch section, "`src/path/to/file.ts` -- <what changes and why>" becomes "`src/path/to/file.ts` -- <what changes and why; match X at path>".

**`skills/spec/SKILL.md` 5b**

- "Synthesize the verdicts", second bullet: "Group the deduped findings: blocking first, then nits, each keeping its `[lens]` tag so the user sees which perspective raised it." becomes "Group the deduped findings: blockers first, one line each; nits last, shorter than blockers, expanded on request. Each keeps its `[lens]` tag so the user sees which perspective raised it."
- "Report + revise loop", Revise bullet: "edit the on-disk spec, re-run the fan-out on the updated spec, re-aggregate. Loop until PASS or the user overrides." becomes "edit the on-disk spec, re-run the fan-out on the updated spec, re-aggregate. From round 2, report only cleared / new / still-open findings. Loop until PASS or the user overrides."

**`skills/spec-review/SKILL.md`**: five rubric edits plus one loop edit:

- Phase 0 intro: "One helper call locates the spec and loads the convention files the tone lens needs:" becomes "One helper call locates the spec and loads the repo conventions and glossary:".
- Phase 0 `conventions` bullet: "`conventions`: AGENTS.md, CONTEXT.md, etc. -- the tone-quality rubric and the glossary to check terms against." becomes "`conventions`: AGENTS.md, CONTEXT.md, etc. -- repo content patterns and the glossary to check terms against."
- Baseline lens: "**Tone quality (per AGENTS.md)**" becomes "**Voice (per this skill's Voice section, Artifacts block)**"; "Use the repo's own `conventions` as the rubric, not generic style rules." becomes "Use the Voice section as the rubric; repo `conventions` inform content, not voice. Voice findings are NITS; duplication that contradicts itself is BLOCKING."
- Verdict contract rules: "Tone nits, polish," becomes "Voice nits, polish,".
- Rules: "the tone rubric is the repo's `conventions`, not generic advice." becomes "the voice rubric is this skill's Voice section, not generic advice."
- Report + revise loop step 2: "On yes -> edit the on-disk spec to clear the agreed findings, then re-run this pass on the updated spec and emit a fresh verdict. Loop until PASS or the user stops." becomes "On yes -> edit the on-disk spec to clear the agreed findings, then re-run this pass on the updated spec and emit a fresh verdict; in chat, report only cleared / new / still-open findings. Loop until PASS or the user stops." The verdict block format is unchanged.

**`test/installer.test.mjs`**: add the Test Cases above to the named describes; follow the existing scratch-HOME pattern.

**`CONTEXT.md`**

- Sentinel token heading: "**Sentinel token** (`{{SLYNK_DIR}}`):" becomes "**Sentinel token** (`{{SLYNK_DIR}}`, `{{SLYNK_VOICE}}`):". Append to its definition: "`{{SLYNK_VOICE}}` expands to the voice snippet instead (same in both modes)."
- Add after it: "**Voice snippet**:" / "The shared Chat + Artifact rules in `lib/voice.md`, expanded into each SKILL.md at `{{SLYNK_VOICE}}`. slynk's voice wins inside slynk artifacts; repo conventions shape content only." / "_Avoid_: "tone file", "style guide" -- AGENTS.md Tone is this repo's, not shipped."

**`AGENTS.md` "After editing any skill"**: add bullet after the SKILL.md one: "- **`lib/voice.md` edits need a re-run** -- the snippet is baked into each rendered SKILL.md, even in `--link` mode." No other AGENTS.md change (Review guidelines don't name sentinel tokens).

**`.github/copilot-instructions.md`**: the Do-NOT-flag bullet "`{{SLYNK_DIR}}` literals in `SKILL.md` -- installer-expanded sentinel, not a bug." becomes "`{{SLYNK_DIR}}` and `{{SLYNK_VOICE}}` literals in `SKILL.md` -- installer-expanded sentinels, not a bug."

**`CHANGELOG.md`**: add `## [Unreleased]` above `## [1.1.0]` with an `### Added` bullet for the voice snippet and a `### Changed` bullet for spec plan/gate-report caps and spec-review's rubric.

### How to verify

- `npm test`, `npm run lint`, `npm run format:check` pass. CI runs ubuntu only; the CRLF case is a simulated-CRLF unit test.
- Smoke (bash, so missing runtimes don't abort): `npm run install:local`, then `bash -c 'shopt -s nullglob; grep -c "State each fact once" ~/.claude/skills/slynk-*/SKILL.md ~/.agents/skills/slynk-*/SKILL.md ~/.copilot/skills/slynk-*/SKILL.md ~/.config/opencode/skills/slynk-*/SKILL.md'` shows 1 per installed file.
- Repeat with `npm run install:local:copy`; restore with `npm run install:local`.

### Assumptions

- Chat drift, handoff docs, and PR bodies get no review-time voice check. Accepted.
- Source SKILL.md CRLF on Windows checkouts (no `.gitattributes`) is pre-existing and out of scope; the LF snippet makes such files mixed-ending.
