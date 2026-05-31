<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# Todo-list Convention

> Spec session -- 2026-05-31
> Issue: [#4](https://github.com/slinkardbrandon/slynk-toolkit/issues/4)
> Parent: docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 1, todo-list convention)

## Summary

Define slynk's todo-list convention: a short standardized instruction that linear,
multi-step skills carry, telling the agent to mirror its own flow as a native
task-list so it stays on-rails. No new infra -- the task-list tool is built into the
runtime. Research (2026-05-31, per-runtime, primary sources) confirms 3 of 4 targets
ship a native tool, each with a different name; Copilot CLI ships none. The block
therefore gates on capability and names **no** specific tool. It degrades to a
re-posted markdown checklist where no tool exists (Copilot CLI), and emits only on
non-trivial runs. Opt-in set: `slynk-spec` and `slynk-create-pr`. A review lens in
CLAUDE.md + copilot-instructions flags linear 4+ step skills that adopt nothing.

## Key Decisions

- **Lives per-skill inline + CONTEXT.md term; no shared runtime file.** Installed
  skills are copied standalone into each agent's dir, so a repo-path reference
  (`docs/conventions/...`) would be a dead link cross-agent (same gap as
  `handoff-context.mjs`). Zero installer changes -> the issue's "not new infra" holds.
- **Capability-gated, names no tool.** Mirrors brainstorm's fan-out gating
  (SKILL.md:70-73). The block gates on "do I have a task-list tool" and lets the agent
  use whatever its runtime exposes -- it hardcodes no name. Proof this is mandatory:
  the names differ across all four targets (CC `TaskCreate`/`TaskUpdate`, OpenCode
  `todowrite`, Codex `update_plan`, Copilot CLI none), and CC alone renamed
  `TodoWrite` -> `TaskCreate` in v2.1.142 (old name now off by default). Hardcoding any
  name is both a Claude-only assumption (copilot-instructions DO-flags it) and
  version-fragile.
- **Markdown fallback is not 1:1 -- re-post, don't write-once.** A native task-list is
  a live widget the agent mutates in place; a markdown checklist is static text in a
  reply and a prior message can't be edited. So the degraded behavior is: **post the
  checklist once, then re-post it with boxes ticked only at meaningful boundaries** -- not
  every micro-step, or it spams the reply stream. This is the **Copilot CLI** path (no
  native tool), not a rare edge case -- it's one of the two priority runtimes.
- **Emit gate = linear 4+ step flow AND a non-trivial run.** One threshold (~4+) reused
  everywhere (issue, emit gate, review lens), not a second number. "Non-trivial" needs an
  operational anchor, because for create-pr the step count is fixed at ~10 regardless of
  diff size, so the gate collapses to just "non-trivial." Tie it to a signal the skill
  already computes: **create-pr** judges at Step 1 (it reads the diff) -- multiple files
  touched or an expected pause for user input -> emit; a single-file or docs-only change
  -> skip. **spec** emits when it expects a real grilling round (questions to the user),
  skips a trivial one-shot. The block states the gate; these anchors live in each skill's
  inserted block.
- **Tasks track the skill's own process steps**, not the downstream work it plans.
  superpowers model: the visible checklist keeps the agent on-rails through its own
  flow.
- **Opt-in = `slynk-spec` + `slynk-create-pr` only.** Exactly the two the
  workflow-review steer named. handoff stays out (5 short linear steps in a single pass --
  the non-trivial gate would never fire; a list there is bolt-on).
- **brainstorm stays out, and its line-85 reference must be reworded.** brainstorm is
  divergent -- a checked-box march fights its purpose. But SKILL.md:85 currently invokes
  "the todo-list convention" _by name_, which once this spec formalizes the term (with a
  linear/static gate that excludes divergent skills) reads as a half-adopted contradiction.
  Reword line 85 to a brainstorm-local soft nudge ("track the flow as a live task-list or
  markdown checklist where supported") that does **not** claim the shared term. This is a
  required migration edit, not a no-op.
- **Review lens, not a mandate.** CLAUDE.md carries the why, copilot-instructions
  the DO-flag checklist (kept in sync per CLAUDE.md's rule). Flags a linear, static
  4+ step skill that tracks nothing; explicitly does NOT flag divergent (brainstorm)
  or short single-pass (handoff) skills.

## Terms Clarified

- **Todo-list convention**: the shared instruction that a linear, static multi-step
  skill carries -- mirror your own flow as native task-list items (one per step),
  updated as you go, to stay on-rails. Capability-gated on the runtime's task-list
  tool (whatever it's named); degrades to a re-posted markdown checklist where none
  exists; emits only on non-trivial 4+ step runs. Tracks the skill's process, not the
  work it plans.
  _Avoid_: calling it infra or a tool to install -- the task-list tool is built into
  the runtime; the convention is just prose each opting-in skill carries. _Avoid_:
  naming a specific tool (`TodoWrite`, etc.) in the block -- names differ per runtime
  and drift per version; gate on capability instead.

## Test Cases

- CC + a non-trivial `slynk-create-pr` / `slynk-spec` run -> native task-list items
  (whatever the active tool is) mirror the skill's steps and update from in-progress to
  done as it progresses.
- CC + a trivial run (1-2 file change) -> no task list; the agent just narrates.
- Copilot CLI (no native tool) -> the list renders as a markdown checklist, posted once
  then re-posted with boxes ticked at meaningful boundaries (not every micro-step).
- The block names no specific tool and no status enum -- it works unchanged whether the
  runtime calls it `TaskCreate`, `todowrite`, or `update_plan`.

## Implementation Plan

### Approach

1. Write one canonical instruction block and inline it into `slynk-spec` and
   `slynk-create-pr`, tailored only by "phase" vs "step" wording.
2. Add the `Todo-list convention` glossary term to CONTEXT.md.
3. Add the review lens to CLAUDE.md (why) and copilot-instructions.md (DO-flag).
4. Mark the roadmap Tier-1 item done and link this spec.

### The block (canonical wording)

> **Track your progress.** If your runtime has a task-list / todo tool (most do; the
> name varies) and this run is non-trivial -- the flow below is 4+ steps _and_ the work
> isn't a quick one-off -- create one task per step and keep it current: mark each in
> progress as you start it, done as you finish. It keeps you on-rails and shows the user
> where you are. No such tool -> render the list once as a markdown checklist and re-post
> it with boxes ticked only at meaningful boundaries (not every micro-step -- you can't
> edit a prior message, so don't spam the full list). Trivial run -> skip it, just
> narrate. This tracks _your_ steps, not the implementation work you plan.

(Swap "step" for "phase" in `slynk-spec`. The block names no tool and no status enum --
the agent uses whatever its runtime exposes.)

### Files to touch

- `skills/spec/SKILL.md` -- add the block at the end of `## Phase 0 -- Load Context`
  (after the glossary-read note, mirroring brainstorm's placement), "phase" wording.
- `skills/create-pr/SKILL.md` -- add the block under `## Workflow`, after the
  Parallelism-strategy blockquote and before `### Step 0` ("step" wording). Sit it
  alongside that note, don't duplicate its framing.
- `skills/brainstorm/SKILL.md` -- reword line 85 so it no longer invokes "the todo-list
  convention" by name (see the opt-out decision above). Required migration, not optional.
- `docs/specs/2026-05-30-brainstorm-skill.md` -- the "todo-convention dependency"
  assumption (line ~111) still says brainstorm "uses the todo-list convention ... adopts
  it when it lands." This spec reverses that (brainstorm is a non-adopter), so reconcile
  the bullet to match -- brainstorm tracks its flow locally, it does not adopt the shared
  convention. Otherwise the two specs contradict after the follow-up lands.
- `CONTEXT.md` -- add the `Todo-list convention` glossary term, and reconcile the
  existing "Mechanism" entry (line ~9) which calls it "task-list convention" -> use one
  name ("todo-list convention", matching the issue and roadmap item).
- `CLAUDE.md` -- add a Todo-list-convention review lens to the "Review guidelines"
  section (the why).
- `.github/copilot-instructions.md` -- add a matching DO-flag item (the checklist).
- `docs/runtime-support.md` -- add a "Todo-list tool" section paralleling the fan-out
  one, now a **verified** table (primary sources, 2026-05-31):

  | Runtime         | Native task-list tool                                                       | Mode              |
  | --------------- | --------------------------------------------------------------------------- | ----------------- |
  | Claude Code     | `TaskCreate`/`TaskUpdate`/`TaskGet`/`TaskList` (v2.1.142+; was `TodoWrite`) | native, live      |
  | OpenCode        | `todowrite`                                                                 | native, live      |
  | Codex           | `update_plan`                                                               | native, live      |
  | Copilot CLI     | none                                                                        | markdown fallback |
  | VS Code Copilot | none in core (todo lists are extension-only)                                | markdown fallback |

- `docs/specs/2026-05-29-slynk-roadmap-mechanisms.md` -- mark the Tier-1 todo-list
  item `[x]` and replace its `<date>-todo-convention.md` placeholder path with this
  spec's real filename (`2026-05-31-todo-list-convention.md`). Also correct the now-false
  body (reference by content, line numbers drift): the "Todo-list convention" Key-Decision
  bullet and the Tier-1 item both call it "the built-in `TodoWrite` tool" / "create a
  `TodoWrite` task" and say it "degrades ... (Copilot/Codex)" -- per this spec's research
  `TodoWrite` was renamed, Codex _has_ `update_plan`, and only Copilot CLI lacks a tool.
  Ticking the box without this leaves the index lying.

### Review lens (CLAUDE.md = why; copilot-instructions = checklist)

- **Flag:** a new/edited `SKILL.md` with a linear, static ~4+ step flow that tells
  the agent to track nothing -- it should carry the todo-list convention (CONTEXT.md).
- **Don't flag** (property-based, so it generalizes to new skills, not a hardcoded
  skill-name allowlist): a flow that **completes in a single uninterrupted pass with no
  user-decision pauses** (handoff), or one whose **steps shift as you go** rather than
  being fixed up front (brainstorm). Those opt out by design.

### Patterns to follow

- brainstorm's capability-gating-on-observed-tools pattern (its "Capabilities (for
  fan-out)" section -- gate on the tool you observe, degrade to text-only). Note its
  flow-tracking line is being reworded by this spec, so match the gating style, not that
  exact line.
- CONTEXT.md glossary format (term, definition, _Avoid_).
- CLAUDE.md's "keep the two in sync" rule between its review lenses and
  copilot-instructions' DO-flag list.
- After editing any SKILL.md, `npm run install:local` re-templates the installed copy.

### How to verify

- `npm run lint && npm run format:check` pass.
- Manual dogfood: run `slynk-create-pr` on a real branch in CC; confirm the task list
  appears and updates; run it on a trivial branch and confirm it doesn't.

### Cross-platform notes (verified 2026-05-31, primary sources)

Per-runtime tool names + modes are in the runtime-support table above. Notes that table
doesn't carry:

- **Copilot CLI's `task`/`/plan` are not a checklist.** `task` spawns subagents, `/plan`
  writes a doc; neither is an agent-mutated list -- so markdown is genuinely its only path.
- **Codex aligns with the emit gate.** Its base prompt already says skip the plan tool
  for trivial/single-step work -- same spirit as our 4+/non-trivial gate, no conflict.
- **OpenCode subagent caveat.** `todowrite` is on for the main agent but off for
  subagents unless permission grants it (open upstream bugs). Skills run on the main
  agent, so unaffected -- noted in case a skill ever fans out.
- **Non-issues:** invocation surface (prose in SKILL.md is portable as-is per the
  matrix); Codex sandbox exec (no helper here -- pure prose).

### Assumptions / watch-points

- These are prose + doc edits; the vitest suite (installer) is unaffected, so "existing
  tests still pass" is the bar (per copilot-instructions' "no unit tests for prose").
- **#1 watch-point (the issue's own warning): ceremony creep.** A 10-item list on a
  2-file change is the failure mode. The non-trivial heuristic is the guard; if create-pr
  spawns lists on trivial branches post-ship, tighten it. Watch this first.
- **Review-lens over-flag risk.** The flag trigger and the don't-flag carve-out are both
  property-based, but "single uninterrupted pass" vs "linear 4+ step" is a judgment call.
  If reviewers start flagging short skills, sharpen the carve-out wording.
