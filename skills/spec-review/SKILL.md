---
name: spec-review
description: >-
  Judge whether a spec is BUILDABLE -- can a cold agent implement it without
  guessing? One deep pass over a single spec, returning a structured PASS/BLOCKED
  verdict with severity-grouped, lens-tagged findings. Takes an optional lens
  flavor (security, cross-platform, design, perf, a11y, ...) that biases the pass
  on top of the baseline rubric. Run it when pointed at a spec, or as the pass a
  caller (slynk-spec's buildability gate) fans out. Not for intent-fit (does the
  design solve the ticket? -- that's the machine-local review-spec, a different
  skill; do not conflate). Not a fuzzy-idea entry point -- slynk-brainstorm and
  slynk-spec shape and write specs; this only judges one that already exists.
argument-hint: optional spec path, then an optional "lens flavor"
---

<what-to-do>

Review one spec for **buildability** -- whether a cold agent could implement it
without guessing -- and return a structured verdict. Judge the artifact's
quality, not whether the design fits intent (that's `review-spec`, a different
skill). Assume the direction is set; ask only whether the document is buildable
as written. One pass, one verdict -- a caller fans out and aggregates, not you.

</what-to-do>

<supporting-info>

## Inputs

```
slynk-spec-review                          -- review the latest spec in output_dir
slynk-spec-review docs/specs/foo.md        -- review a specific spec
slynk-spec-review "" "security"            -- latest spec, security-flavored pass
slynk-spec-review docs/specs/foo.md "cross-platform"
```

- **Path** (optional): which spec to review. Omitted -> the latest spec in the
  repo's `output_dir`.
- **Flavor** (optional, open-ended): a lens emphasis derived from the work
  (`security`, `cross-platform`, `design`, `perf`, `a11y`, ...). Not an enum --
  pick what the spec's subject warrants. No flavor -> baseline only.

## Phase 0 -- Resolve the spec

One helper call locates the spec and loads the convention files the tone lens
needs:

```bash
node "{{SLYNK_DIR}}/spec-review-context.mjs" [<spec-path>]
```

> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir, so the helper
> runs by absolute path -- no PATH lookup. If the command isn't found, the
> toolkit isn't installed: run `npx slynk-toolkit`. If the helper can't exec at
> all (e.g. a sandbox approval prompt), read the spec + AGENTS.md/CONTEXT.md
> yourself -- the pass is text-only and doesn't strictly need the helper.

Returns one JSON blob:

- `spec`: `{ path, relativePath, content }` -- the resolved spec. Read `content`;
  it's the review target.
- `config`: `outputDir` / `contextFile`.
- `conventions`: AGENTS.md, CONTEXT.md, etc. -- the tone-quality rubric and the
  glossary to check terms against.
- `error`: a string when no spec was found (`spec` is then `null`). Surface it
  and stop -- ask for an explicit path. Never invent a verdict for a spec you
  couldn't read.

## The review -- one deep pass

Read the whole spec, then judge it against the **baseline lenses** (always, every
pass):

- **Implementability / completeness** -- could a cold agent build this without
  asking you a question? Missing files, undefined behavior, unstated contracts,
  steps that assume context not in the doc.
- **Internal consistency** -- decisions that contradict each other, a plan that
  doesn't match the summary, test cases that don't cover the stated behavior, a
  term used two ways.
- **Open questions / gaps** -- unresolved decisions parked as assumptions that
  actually block the build; edge cases the plan ignores.
- **Tone quality (per AGENTS.md)** -- AI-isms, hedging, preamble, prose blocks
  that should be tables/lists, wordiness that buries signal. Use the repo's own
  `conventions` as the rubric, not generic style rules. (Formatting like
  em-dashes is the linter's job, not yours.)

If a **flavor** was passed, keep the baseline floor and add that emphasis on top
-- e.g. `security`: auth/secrets/injection/trust-boundary gaps the baseline pass
wouldn't dwell on; `cross-platform`: runtime/OS/path assumptions; `design`: UX
states, error/empty/loading paths. The flavor sharpens one pass; it never
replaces the baseline.

Challenge spec terms against the CONTEXT.md glossary in `conventions` -- a term
that conflicts with or duplicates an existing definition is a finding.

## Verdict contract

End every pass with exactly this block, so any caller aggregates it
mechanically. Tag each finding with the lens that raised it (`baseline`,
`security`, `cross-platform`, ...) so synthesis can group and dedupe.

```
VERDICT: PASS | BLOCKED
BLOCKING:
- <finding> -- <where in spec> -- <why it blocks buildability> [lens]
NITS:
- <finding> -- <where> [lens]
```

Rules:

- `VERDICT:` is always present, exactly `PASS` or `BLOCKED`.
- **BLOCKED** iff at least one blocking finding exists -- something a cold agent
  cannot build past without guessing. Tone nits, polish, and "would be nicer"
  are NITS, not blockers.
- A clean spec: `VERDICT: PASS`, empty `BLOCKING:`, NITS optional.
- `<where>` points into the spec (section heading or quoted phrase) so a fix is
  locatable.

## Report + revise loop

Never silent-edit the spec -- it's the user's artifact.

1. Emit the verdict block, then offer to act:

   > Found N blocking, M nits. Want me to revise the spec on disk, or leave it?

2. On yes -> edit the on-disk spec to clear the agreed findings, then re-run this
   pass on the updated spec and emit a fresh verdict. Loop until PASS or the user
   stops.
3. On no -> leave the spec untouched. The verdict stands as the record.

When a caller (e.g. `slynk-spec`'s buildability gate) runs you as one fanned
reviewer, skip the offer -- just return the verdict block. The caller owns the
revise loop.

## Cross-agent floor

This is one text-only pass -- it loads and runs on every runtime with no subagent
primitive, no web tools, no slash UX. The helper degrades gracefully (a missing
spec is an `error` string, not a crash). The verdict block is plain text, so any
caller on any runtime can parse it.

## Rules (every pass)

- **Buildability, not intent-fit.** Judge the artifact, not the decision. Intent-fit
  is `review-spec` -- a different skill; don't drift into it.
- **One pass, one verdict.** No reviewer count, no fan-out awareness. The caller
  orchestrates and aggregates.
- **Blocking means blocking.** A finding blocks only if it stops a cold agent
  from building. Everything else is a nit.
- **Derive from the spec and the repo.** Findings cite a place in the spec;
  the tone rubric is the repo's `conventions`, not generic advice.
- **Never silent-edit.** Report, offer, revise on yes, re-review. The spec stays
  the user's.

</supporting-info>
