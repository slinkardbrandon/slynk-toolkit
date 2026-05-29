# slynk-toolkit Roadmap & Mechanism Adoption

> Spec session — 2026-05-29
> Parent/umbrella spec. Each line item links to its own dedicated spec as it gets written.

## Summary

slynk-toolkit stays a lightweight, cross-agent skills project. We selectively adopt
superpowers' _mechanisms_ (session bootstrap, skill-invocation forcing, task-lists)
**without** its forced ceremony, add a `/tdd` testing-mindset lens wired into `/spec`,
and move to a distribution model that works across Claude / Copilot / Codex / OpenCode
out of the box. This doc is the durable index — it captures the goals and the dependency
order; the real design work happens in dedicated per-item specs.

## Guiding principles (carried from the existing toolkit)

- **Lightweight by default, dialable up.** Adopt superpowers' mechanisms, not its mandatory gates.
- **Cross-agent first.** One `SKILL.md` works on Claude Code and Copilot CLI today; Codex/OpenCode next.
- **Derive, don't invent.** Skills read real config/code as source of truth (e.g. `create-pr` derives CI checks).
- **Each skill owns one thing.** No skill bleeds into another's artifact.
- **Never invent what you can look up.** Applies to specs too — the PR/ship skills must be
  transcribed from the user's existing machine flavors, not freshly designed.

## Key Decisions

- **Distribution:** npm installer **and** keep the Claude marketplace. `npx slynk-toolkit`
  copies/symlinks skill dirs into each agent's skills location; the marketplace stays for the
  native `claude plugin install` one-liner + auto-update. (Proven by GSD shipping to 15 runtimes.)
- **Bootstrap:** ship the mechanism, default to `suggest`, dialable to `force`. A CC SessionStart
  hook is the "magic" layer on Claude; `AGENTS.md`/instructions carry the nudge on every other agent.
- **Todo-list convention:** not new infra — it's the built-in `TodoWrite` tool. superpowers gets
  on-rails task-lists by instructing skills to "create a task per checklist item." We adopt this as a
  shared convention; it degrades to a markdown checklist where the tool is absent (Copilot/Codex).
- **`/tdd`:** a short standalone _testing-mindset lens_ (real behaviors not coverage; fail-first
  bug→repro-test→fix). NOT an executor. `/spec` classifies the work and conditionally invokes it.
- **`/ship`:** dropped from the roadmap — too custom; the end-to-end implementation flow doesn't
  apply cleanly across projects, so it's not a base-offering skill.
- **Ticket-creation skill:** out of scope for the base offering — too company/project-specific.
- **Structure:** this roadmap is the parent. Each item gets its own dedicated spec session so context
  stays clean and exploration stays focused.

## Terms Clarified

- **Mechanism vs ceremony**: a _mechanism_ is reusable plumbing (bootstrap hook, task-list
  convention, subagent fanout). _Ceremony_ is mandatory process layered on top (forced gates,
  required artifacts). slynk adopts mechanisms; it rejects forced ceremony.
  _Avoid_: using "superpowers-style" to mean both at once.
- **Bootstrap mode**: the `suggest | force | off` setting controlling how strongly the session-start
  preamble pushes skill discovery. `suggest` = lightweight nudge; `force` = the 1%/MUST language.
  _Avoid_: "the hook" (the CC hook is only the Claude delivery layer for this, not the mode itself).
- **Mindset lens** (`/tdd`): a short reference skill that shapes _how to think about what to test_,
  invoked to influence planning — not a skill that writes or runs tests.
  _Avoid_: "the TDD skill" implying an executor.
- **Work classification** (in `/spec`): bug | feature | chore/config | ticket-only. Drives whether
  `/tdd` is pulled in (bug/feature → yes; chore/ticket-only → skip).

## Roadmap

### Tier 1 — Mechanisms (settle first; they constrain every skill's shape)

These three are **independent of each other** and can be specced in parallel:

- [ ] **npm distribution + marketplace** → `docs/specs/<date>-npm-distribution.md` _(not yet written)_
  - `npx slynk-toolkit` installer: prompt runtime (Claude/Copilot/Codex/OpenCode) + global/local scope.
  - Copy or symlink skill dirs into each agent's skills location.
  - Keep the Claude marketplace for `claude plugin install` + auto-update.
  - Open questions for that spec: symlink vs copy per OS; how `${CLAUDE_PLUGIN_ROOT}` equivalents
    resolve on each agent; update/repair flow; idempotency.
- [ ] **bootstrap dial (suggest→force)** → `docs/specs/<date>-bootstrap-dial.md` _(not yet written)_
  - CC SessionStart hook injects the discovery preamble; `AGENTS.md` carries it cross-agent.
  - `.slynk.yml` `bootstrap: suggest | force | off`, default `suggest`.
  - Open questions: exact preamble wording per mode; how `force` language reads without superpowers'
    persuasion-table heaviness; per-agent delivery (hook vs AGENTS.md vs instructions files).
- [ ] **todo-list convention** → `docs/specs/<date>-todo-convention.md` _(not yet written)_
  - Shared convention: skills with checklists instruct the agent to create a `TodoWrite` task per item.
  - Open questions: where the convention lives (shared reference? per-skill?); graceful degradation to
    markdown checklist on agents without the tool; which skills opt in.

Then, depends on todo-convention + bootstrap:

- [ ] **/tdd mindset lens + /spec wiring** → `docs/specs/<date>-tdd-lens.md` _(not yet written)_
  - `/tdd`: short standalone reference — real behaviors not coverage; fail-first bug→repro-test→fix.
  - `/spec`: add explicit work classification; **bug/feature → invoke `/tdd`** to shape Test Cases;
    **chore/config/ticket-only → skip**.
  - Known soft spot: making the conditional invoke _reliable_ (not vibes). Flag as "play with it,"
    not solved. No delete-and-restart absolutism.

### Tier 2 — Missing skills (need mechanisms settled AND existing flavors gathered)

**Prerequisite for both:** collect the user's current flavors off his machines and transcribe
the real patterns — do not invent. These are reviewer/author-side companions to the existing
`spec`/`handoff`/`create-pr`.

- [ ] **pr-review fanout** → `docs/specs/<date>-pr-review.md` _(not yet written)_
  - Agent fanout + personas. Consider the two-axis split (does it match spec? vs is it well-built?),
    reported separately so one axis can't mask the other.
- [ ] **pr-triage** → `docs/specs/<date>-pr-triage.md` _(not yet written)_
  - Review and address incoming PR feedback — automatically vs talk-through mode.

### Tier 3 — Cleanup

- [ ] **grill→spec naming leftover** — `spec-context.mjs` still has `getRecentGrillDocs` /
      `readGrillConfig` from before the rename. (May already be addressed in PR #1 — verify.)
- [ ] **Merge PR #1 hardening** — BSD grep `\s` secrets-scan bug, dash-incompatible bash arrays,
      apostrophe-breaking spec-write (`echo '…' | node`), `/tmp/slynk/` scratch namespacing, `master→main`
      fallback, CHANGELOG, version bump. This is the production-grade portability pass; merge before
      building on top.

## How to verify

- Roadmap committed to `docs/specs/` and serves as the index for all sub-specs.
- Each Tier item links to a dedicated spec doc (filled in as written).
- Dependency order respected: Tier 1 mechanisms before Tier 2 skills; PR/ship specs gated on
  gathering existing flavors first.

## Assumptions

- The three Tier 1 mechanism specs are mutually independent and parallelizable.
- `/tdd` classification reliability is an open experiment, not a solved problem.
- Ticket-creation stays out of the base offering unless the user revisits it.
- PR #1 should likely merge before Tier 1 work lands, so new skills build on the hardened base.
