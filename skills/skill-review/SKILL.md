---
name: skill-review
description: >-
  Judge whether a skill folder is SHIPPABLE -- will it get routed to when it
  should, load on every runtime, and run without guessing? One deep pass over
  one skill, returning a structured PASS/BLOCKED verdict with severity-grouped,
  lens-tagged findings. Takes an optional lens flavor (cross-platform,
  security, slimness, ...) that biases the pass on top of the baseline rubric.
  Use when asked to review, judge, or QA an existing skill, e.g. "review this
  skill", "is this skill shippable?", or as the pass a caller
  (slynk-write-skill's review gate) fans out. Not for authoring or fixing a
  skill -- slynk-write-skill writes; this only judges. Not for reviewing specs
  -- use slynk-spec-review.
argument-hint: skill dir path, then an optional "lens flavor"
---

<what-to-do>

Review one skill folder for **shippability** -- whether it will be routed to,
load cross-agent, and run without the executing agent guessing -- and return a
structured verdict. Judge the artifact, not whether the skill should exist
(that decision was the author's). One pass, one verdict -- a caller fans out
and aggregates, not you.

</what-to-do>

<supporting-info>

## Inputs

```
slynk-skill-review skills/teach                       -- baseline pass
slynk-skill-review skills/teach "cross-platform"      -- flavored pass
```

- **Path** (required): the skill dir to review.
- **Flavor** (optional, open-ended): an emphasis derived from the skill's
  subject (`cross-platform`, `security`, `slimness`, `routability`, ...). Not
  an enum. No flavor -> baseline only.

## Phase 0 -- Load the skill

One helper call:

```bash
node "{{SLYNK_DIR}}/skill-review-context.mjs" <skill-dir>
```

> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir. If the helper
> can't exec at all, read the folder's files yourself -- the pass is text-only
> and doesn't strictly need it.

Returns one JSON blob: `skillMd` (the review target), `helpers` (sources --
ones ending `...(truncated)` were cut at 8k chars; read those in full on disk
before judging them), `references` (sibling doc names -- read the ones the
SKILL.md leans on), `mechanical` (the deterministic lint, pre-run; `null`
means the sibling `slynk-write-skill` lint wasn't found -- proceed without it
and note that in the verdict), and `error` when the target isn't a skill --
surface that and stop; never invent a verdict for a skill you couldn't read.

## The review -- one deep pass

`mechanical` already covers the script-checkable rules (frontmatter shape,
description length/trigger clause, echo-pipes, helper imports, sentinel use).
Fold its findings into yours -- errors as blocking, warns as nits -- and don't
re-derive them. Your pass adds what a script can't judge, against the
**baseline lenses**:

- **Routability** -- does the description route? What it does in the first
  sentence, real trigger phrases a user would actually say, disjoint from
  sibling skills with "Not for X -- use Y" pointers. Would a router holding
  only descriptions ever pick this skill at the right moment -- and never at
  the wrong one?
- **Executability** -- could an agent that has never seen this repo follow the
  body without guessing? Steps in order, helper outputs explained, failure
  modes (helper missing, not installed, state absent) given a stated fallback.
- **Cross-agent floor** -- every rich capability (subagents, web, browser
  open, task lists) gated on observed capability with a stated text-only
  degradation; no runtime brands or tool names as load-bearing assumptions.
- **Slimness & ownership** -- prose spent on judgment, mechanics in helpers,
  depth one level deep in references, no restated boilerplate; the skill owns
  one thing and names where adjacent jobs route.

If a **flavor** was passed, keep the baseline floor and add that emphasis on
top -- e.g. `security`: path traversal in helper inputs, shell interpolation,
secrets handling; `cross-platform`: OS/path/opener assumptions in helpers;
`slimness`: line-by-line "does this sentence carry signal?".

## Verdict contract

End every pass with exactly this block, so any caller aggregates it
mechanically. Tag each finding with the lens that raised it (`baseline`,
`mechanical`, `security`, ...).

```
VERDICT: PASS | BLOCKED
BLOCKING:
- <finding> -- <where: file + section/line> -- <why it blocks shipping> [lens]
NITS:
- <finding> -- <where> [lens]
```

Rules:

- `VERDICT:` is always present, exactly `PASS` or `BLOCKED`.
- **BLOCKED** iff at least one blocking finding exists -- the skill won't
  route, won't load somewhere it claims to, or an executing agent must guess.
  Tone, polish, and "would be nicer" are NITS.
- A clean skill: `VERDICT: PASS`, empty `BLOCKING:`, NITS optional.
- `<where>` points into a file (heading or quoted phrase) so a fix is
  locatable.

## Report + revise loop

Never silent-edit the skill -- it's the author's artifact.

1. Emit the verdict block, then offer:

   > Found N blocking, M nits. Want me to revise the skill on disk, or leave it?

2. On yes -> edit, re-run this pass (helper included -- the mechanical lint
   must re-run too), emit a fresh verdict. Loop until PASS or the user stops.
3. On no -> the verdict stands as the record.

When a caller (e.g. `slynk-write-skill`'s review gate) runs you as one fanned
reviewer, skip the offer -- return only the verdict block. The caller owns the
revise loop.

## Rules (every pass)

- **Shippability, not existence.** Judge the folder as built, not the decision
  to build it.
- **One pass, one verdict.** No fan-out awareness; the caller orchestrates.
- **Blocking means blocking.** Won't route / won't load / forces guessing --
  everything else is a nit.
- **Derive from the folder.** Findings cite a file and place; the rubric is
  the toolkit doctrine the mechanical lint encodes plus the lenses above, not
  generic style advice.
- **Cross-agent.** One text-only pass; the helper degrades to reading files
  yourself; the verdict block is plain text any caller can parse.

</supporting-info>
