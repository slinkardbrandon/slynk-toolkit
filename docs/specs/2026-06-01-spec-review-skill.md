<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# slynk-spec-review (artifact-quality critic + slynk-spec buildability gate)

> Spec session -- 2026-05-31
> Issue: [#6](https://github.com/slinkardbrandon/slynk-toolkit/issues/6)
> Parent: docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 2, spec-review)

## Summary

A single-pass spec-quality critic that judges **buildability** (not intent-fit), takes an
optional lens-flavor arg, and returns a structured verdict. Runs standalone on any spec.
`slynk-spec` invokes it as a hard final gate: after writing the spec draft to disk, it fans out
~3 work-flavored reviewers (each running the single-pass skill), aggregates the verdicts, and
withholds the resume prompt until PASS or explicit user override.

## Key Decisions

- **Single-pass skill; fan-out is the caller's job.** `slynk-spec-review` reviews one spec in one
  pass and emits one verdict -- no reviewer count, no awareness of being fanned. The caller
  (`slynk-spec`'s gate, or an ad-hoc agent) orchestrates fan-out. Cleanest separation; the skill
  stays runtime-agnostic and works text-only everywhere.
- **Caller owns fan-out; ~3 reviewers default** -- lives in `slynk-spec`'s gate source (editable),
  NOT the review skill. Degrades to 1 inline pass where there's no subagent primitive.
- **Optional lens-flavor arg biases one pass.** `slynk-spec-review [<spec-path>] ["<flavor>"]`.
  No flavor -> baseline buildability (implementability/completeness, internal consistency,
  open-questions/gaps, tone-quality per AGENTS.md). Flavor (e.g. security, cross-platform, design,
  perf, a11y) -> baseline floor PLUS that emphasis. Open-ended, derived from the work, not an enum.
- **Perspective-diverse fan-out.** `slynk-spec`'s gate auto-derives 1-2 work-relevant flavors from
  the spec content + work classification and assigns distinct flavors across the reviewers (e.g. an
  installer spec -> baseline + security + cross-platform). Diversity catches failure modes N
  identical passes can't. Baseline always runs regardless of flavor.
- **Hard gate, agent-side, user-collapsible.** The agent will not emit the resume prompt while the
  aggregate verdict is BLOCKED; only an explicit user override skips it. Mirrors brainstorm's gate
  and spec's "just start implementing" -- hard for the agent, collapsible by the user. No
  delete-and-restart absolutism.
- **Report + revise loop, never silent-edit.** Findings grouped blocking vs nits; offer to revise
  the on-disk spec, then re-review (loop). The spec stays the user's artifact.
- **Verdict contract** (the return value that makes aggregation mechanical):

  ```
  VERDICT: PASS | BLOCKED
  BLOCKING:
  - <finding> -- <where in spec> -- <why it blocks buildability> [lens]
  NITS:
  - <finding> -- <where> [lens]
  ```

  Findings tagged with the lens that raised them so synthesis can group/dedupe.

- **Aggregation rule:** any reviewer's blocking finding -> aggregate BLOCKED (dedupe overlaps).
  Tunable if too strict in practice.
- **Not a bootstrap-router entry.** Invoked by `slynk-spec` or run on a spec -- not a fuzzy-moment
  workflow entry point, so no router row. The installer still auto-installs it (it scans `skills/*`).
- **Opts out of the todo-list convention** -- a single uninterrupted pass, like handoff.
- **Artifact-quality, disjoint from intent-fit.** Distinct from the machine-local `review-spec`
  (does the design solve the ticket?). Description carries bidirectional "not for intent-fit / not a
  workflow entry" pointers so triggers stay disjoint.
- **Fan-out gating reuses brainstorm's pattern verbatim** -- gate on the observed subagent
  primitive, static fallback table from `docs/runtime-support.md`, distilled claim+source dispatch.

## Terms Clarified

- **Buildability gate**: the QC step at `slynk-spec`'s tail that blocks the resume prompt until the
  on-disk spec passes review (can a cold agent build this?). Agent-hard, user-collapsible.
  _Avoid_: "spec approval" -- it judges artifact buildability, not intent-fit.
- **Lens flavor**: an optional, open-ended emphasis passed to `slynk-spec-review` (security,
  cross-platform, design, ...) that biases a single pass on top of the baseline rubric.
  _Avoid_: a fixed lens enum -- flavors derive from the work.
- **Verdict**: `slynk-spec-review`'s structured PASS/BLOCKED return with severity-grouped,
  lens-tagged findings; the contract a caller aggregates.

(Distinct from the machine-local **`review-spec`** = intent-fit. This is **`slynk-spec-review`** =
artifact quality. Do not conflate.)

## Test Cases

- Installer auto-installs `slynk-spec-review` into every detected runtime (the generic install
  tests cover it once `skills/spec-review/` exists; frontmatter `name` == dir).
- `spec-review-context.mjs`: resolves an explicit spec path; resolves the latest spec in
  `output_dir` when no path is given; respects a `.spec.yml` `output_dir` override; returns a
  graceful "no spec found" signal rather than throwing.
- Verdict block is parseable -- `VERDICT: PASS|BLOCKED` always present; findings under
  `BLOCKING:`/`NITS:`.
- Standalone single pass runs text-only on every runtime (no subagent primitive needed).
- Optional flavor arg biases the pass: a `"security"` flavor surfaces security findings the
  baseline pass would not emphasize, with the baseline lenses still covered.
- `slynk-spec`'s gate withholds the resume prompt on aggregate BLOCKED; proceeds on PASS; proceeds
  on an explicit user override despite BLOCKED.
- No subagent primitive -> the gate degrades to 1 inline `slynk-spec-review` pass as the floor.
- Perspective-diverse dispatch: the gate derives >=1 work-relevant flavor and assigns distinct
  flavors across reviewers (verify via the dispatch prose for a representative work type).

## Implementation Plan

### Files to touch

- `skills/spec-review/SKILL.md` (new) -- single-pass review skill: input (`[<path>] ["<flavor>"]`),
  baseline lens rubric, optional flavor emphasis, verdict contract, standalone revise offer,
  text-only cross-agent floor, description with disjoint-trigger pointers.
- `skills/spec-review/spec-review-context.mjs` (new) -- dependency-free `{{SLYNK_DIR}}` helper:
  resolve target spec (explicit path or latest in `output_dir` from `.spec.yml`), read + return
  content + config, graceful no-spec signal. Mirrors `spec-context.mjs`.
- `skills/spec/SKILL.md` (edit) -- insert the QC gate in Phase 5 between 5a (write artifact) and 5b
  (emit resume prompt): capability-gated fan-out (~3, default in source), derive + assign
  work-relevant flavors, each reviewer uses `slynk-spec-review`, synthesize verdicts, hard-gate
  (agent-side, user-collapsible), report + revise loop, degrade to 1 inline pass.
- `README.md` -- add `spec-review` to the skills table.
- `docs/runtime-support.md` -- note spec-review fan-out rides the existing fan-out capability row
  (no new matrix).
- `docs/specs/2026-05-29-slynk-roadmap-mechanisms.md` -- mark spec-review specced, link this doc.
- `test/installer.test.mjs` -- add `spec-review-context.mjs` resolution tests (path / latest /
  override / empty).

### Approach

1. Build `slynk-spec-review` SKILL.md + helper: resolve target -> one deep pass across the baseline
   lenses (+ optional flavor) -> emit verdict + severity-grouped, lens-tagged findings -> standalone
   offer to revise.
2. Lock the verdict contract so any caller aggregates mechanically.
3. Wire `slynk-spec`'s Phase 5 gate: fan out flavored reviewers using the skill, synthesize,
   hard-gate, revise loop, degrade path.
4. Helper + docs + tests; dev-install and dogfood (run it on this very spec).

### Patterns to follow

- brainstorm's Phase 2a fan-out (capability gating + static table + distilled claim+source dispatch).
- spec/brainstorm helper conventions (`{{SLYNK_DIR}}`, dependency-free, `/tmp/slynk` scratch,
  own-path resolution, `execFileSync` over interpolated shell, apostrophe-safe).
- Gate philosophy: brainstorm's gate + spec's "just start implementing" (agent-hard,
  user-collapsible).
- AGENTS.md tone rules as the quality lens; exact installed-name references (`slynk-spec-review`);
  disjoint triggers with bidirectional pointers.
- After editing any SKILL.md, re-run `npm run install:local`.

### How to verify

- `npm test` green; `npm run lint && npm run format:check`.
- Dev-install; run `slynk-spec-review` standalone on an existing spec -> parseable verdict +
  findings; run with a flavor -> biased findings.
- Run `slynk-spec` end-to-end -> fans out, gates on BLOCKED, emits the prompt only on PASS/override;
  with no subagent primitive, one inline pass.

### Assumptions

- Aggregation: any blocking finding -> BLOCKED (dedupe). Tunable.
- Fanned subagents can be told to load `slynk-spec-review`; where a runtime can't, the dispatch
  inlines the rubric or spec falls to one inline pass.
- ~3 reviewers is the opinionated default; edit spec's source to change.
