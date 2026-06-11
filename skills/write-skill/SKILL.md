---
name: write-skill
description: >-
  Author a new agent skill the toolkit way: gather what it should do, scaffold
  the folder, draft a SKILL.md with a router-grade description, push
  deterministic work into dependency-free .mjs helpers, and gate on a
  mechanical check plus review. Use when the user wants to create, write, or
  build a new skill, e.g. "make a skill for X", "turn this workflow into a
  skill". Not for judging an existing skill -- use slynk-skill-review. Not for
  shaping whether X should even be a skill -- that's a fuzzy idea, use
  slynk-brainstorm first.
argument-hint: what the skill should do (optional)
---

<what-to-do>

Take "I want a skill that does X" to a finished skill folder: one SKILL.md
(+ optional dependency-free `.mjs` helpers) that loads on every runtime and
gets routed to when it should. The description is the product -- it's the only
thing a router sees -- and anything deterministic belongs in a helper, not in
prose. Finish by linting mechanically and reviewing for judgment-level issues.

</what-to-do>

<supporting-info>

## Inputs

```
/write-skill                          -- describe the skill next turn
/write-skill "changelog from merged PRs"  -- inline description
```

Track the steps below as a task list where your runtime has one (markdown
checklist otherwise) -- this is a linear flow and it's easy to skip the gate at
the end.

## Step 1 -- Gather requirements

Resolve these before touching disk (recommend answers; don't interrogate):

- **Job + artifact.** What does it do, and what artifact does it own? A skill
  that owns two things is two skills.
- **Triggers.** The literal phrases a user would say. These become the
  description's "Use when" clause verbatim.
- **Disjointness.** List the skills already installed in this environment and
  name any with overlapping triggers. Overlap -> sharpen both directions with
  "Not for X -- use Y" pointers (and note the sibling needs the mirror edit).
- **Deterministic ops.** State probing, file writing, validation, numbering,
  CLI detection -> helper scripts. Judgment, phrasing, tradeoffs -> SKILL.md
  prose. List the helpers now, with one-line jobs.
- **Depth.** Formats, rubrics, or long examples -> sibling reference files
  (FORMAT.md style), linked one level deep, never restated.

## Step 2 -- Scaffold

```bash
node "{{SLYNK_DIR}}/skill-scaffold.mjs" --name <kebab-name> [--root <skills-dir>] [--helper <name>]
```

> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir. If the command
> isn't found, the toolkit isn't installed -- run `npx slynk-toolkit`.

`--root` defaults to `./skills` when present (a toolkit-style repo), else the
cwd. Repeat `--helper` per script. The skeleton arrives doctrine-compliant:
trigger-stub description, `<what-to-do>`/`<supporting-info>` split, sentinel
helper calls. It refuses to overwrite an existing dir.

## Step 3 -- Draft

Fill the skeleton. The order matters -- description first, while the trigger
list from Step 1 is fresh:

- **Description doctrine.** Third person. First sentence: what it does. Then
  "Use when ..." with the Step 1 trigger phrases. Then disjointness pointers
  ("Not for X -- use <exact-skill-name>"). Cap 1024 chars. A description that
  could caption a different skill is too vague.
- **Body.** Phases/steps in workflow order. Helpers carry setup and mechanics;
  prose carries judgment. Prose content reaches helpers via a scratch file or
  stdin -- never `echo '...' | node`.
- **Helpers.** Dependency-free (node: built-ins only), resolve their own
  paths, `execFileSync` over interpolated shell strings, emit JSON, never
  throw -- unreachable state reports cleanly so the skill degrades.
- **Cross-agent floor.** Gate every rich capability (subagents, web, browser
  open) on your observed tool list, never a runtime brand or tool name, and
  say what the text-only degradation is.

## Step 4 -- Mechanical check

```bash
node "{{SLYNK_DIR}}/skill-check.mjs" <path-to-skill-dir>
```

Returns `{ pass, findings }` and exits 1 on any error-level finding. Fix
errors and re-run until `pass: true`; fix warns or justify each one to the
user in a line. Don't hand-wave a warn away silently.

## Step 5 -- Review gate

The mechanical check can't judge trigger overlap, tone, or whether the
description routes. Gate before shipping:

- **Subagent primitive available** (your own tool list) -> fan out 2-3
  `slynk-skill-review` passes (that exact installed name) over the folder, one
  baseline plus 1-2 flavors the skill's subject warrants (cross-platform,
  security, ...). Tell each to return only its verdict block; you own the
  revise loop.
- **No subagent primitive** -> run one inline `slynk-skill-review` pass. The
  gate never silently disappears.
- **slynk-skill-review not installed** -> review against its lenses yourself
  and say that's what happened.

Aggregate BLOCKED iff any blocking finding. Revise -> re-check (Step 4) ->
re-review until PASS or the user overrides ("ship it anyway"). You may not
collapse the gate yourself.

## Step 6 -- Ship

Where the folder lands decides how it loads:

- **In a toolkit-style repo** (skills/ + installer): re-run the installer so
  the new skill is templated and routed, and remind the user to reload skills.
- **Standalone**: move/copy it into the runtime's skills dir and reload.

Then offer the loose ends: a README row if the repo lists skills, glossary
terms the session coined, and the mirror "Not for" edits in overlapping
siblings (Step 1).

## Rules (every run)

- **The description is the product.** A perfect body behind an unroutable
  description never runs.
- **Scripts over tokens.** Anything a script can do deterministically, a
  script does. SKILL.md spends its lines on judgment.
- **Gate, don't vibe-check.** Mechanical check + review pass before shipping;
  the user collapses gates, you don't.
- **Own one thing.** Authoring is this skill. Judging an existing skill is
  `slynk-skill-review`; shaping a fuzzy "should this exist?" is
  `slynk-brainstorm`.
- **Cross-agent.** This file + two helpers load everywhere; the review fan-out
  degrades to one inline pass; text-only always works.

</supporting-info>
