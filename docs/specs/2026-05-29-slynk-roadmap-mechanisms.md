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
  - **Workflow review steer:** `force` is the highest ceremony risk and has no natural trigger
    (set-once-and-forget; nags on unrelated sessions). Keep `suggest`/`off` as the real product;
    treat `force` as a de-emphasized escape hatch, and scope its language to skill-relevance, not a
    blanket "you MUST check skills" on every session start.
- [ ] **todo-list convention** → `docs/specs/<date>-todo-convention.md` _(not yet written)_
  - Shared convention: skills with checklists instruct the agent to create a `TodoWrite` task per item.
  - Open questions: where the convention lives (shared reference? per-skill?); graceful degradation to
    markdown checklist on agents without the tool; which skills opt in.

Then, depends on todo-convention + bootstrap:

- [ ] **/tdd mindset lens + /spec wiring** → `docs/specs/<date>-tdd-lens.md` _(not yet written)_
  - `/tdd`: short standalone reference — real behaviors not coverage; fail-first bug→repro-test→fix.
  - `/spec`: add explicit work classification; **bug/feature → use `/tdd`** to shape Test Cases;
    **chore/config/ticket-only → skip**.
  - **Workflow review steer:** classification should **swap** spec's existing Phase 2 test-nudge,
    not layer on top — bug/feature pulls the tdd lens text into that one block, chore/ticket drops
    it. Don't run two test-thinking passes.
  - **Lens not executor:** inline the lens _content_ into spec's test step rather than a
    skill-to-skill invoke — a real `/tdd` invocation tempts the agent to start writing tests, which
    is exactly what the lens is not. Mechanical inlining makes the "play with it" soft spot moot.
  - No delete-and-restart absolutism.

### Tier 2 — Missing skills (need mechanisms settled AND existing flavors gathered)

**Prerequisite for both:** collect the user's current flavors off his machines and transcribe
the real patterns — do not invent. These are reviewer/author-side companions to the existing
`spec`/`handoff`/`create-pr`.

- [ ] **pr-review fanout** → `docs/specs/<date>-pr-review.md` _(not yet written)_
  - Agent fanout + personas. Consider the two-axis split (does it match spec? vs is it well-built?),
    reported separately so one axis can't mask the other.
  - **Workflow steer:** the "matches spec" axis needs the originating spec — make pr-review look up
    the spec in `docs/specs/` to close the loop with `/spec`'s artifact.
- [ ] **pr-triage** → `docs/specs/<date>-pr-triage.md` _(not yet written)_
  - Review and address incoming PR feedback — automatically vs talk-through mode.
  - **Workflow steer:** "automatically" mode must still surface what it changed (mirror create-pr's
    show-what-was-fixed).

### Tier 2.5 — Existing-skill polish (from workflow review)

Normalize **before** pr-review/pr-triage get specced, so new skills don't copy current
inconsistencies.

- [ ] **Close the spec→create-pr loop** — `/spec`'s resume prompt never tells the implementing
      session to run `/create-pr`. Add a forward-reference + test/verify expectations (mirror
      handoff's "Suggested Skills" section). Highest-value / lowest-effort loop fix.
- [ ] **`/spec` "just start implementing" writes no artifact** — contradicts Rule 8 ("the spec doc
      is the artifact"). Either write the artifact first on that branch, or state plainly no doc is saved.
- [ ] **Trim spec's trailing prompts** — Phase 5c duplicates Phase 4's menu; fold the redundant
      options and make the Phase 6 glossary offer a single line, not a framed prompt.
- [ ] **Cross-skill UX consistency** — add "Cancel" to spec's menus (create-pr has it, spec doesn't);
      one shared resume-prompt template between spec and handoff; consistent exit-ramp vocabulary.
- [ ] **Spec lifecycle/status** — `specHistory` resurfaces completed specs as if pending. A cheap
      `> Status: implemented in <PR>` append (from create-pr) would keep the history meaningful.
- [ ] **Cosmetic:** spec/SKILL.md still says "grilling" in ~4 places though the skill is named `spec`.

### Tier 1.5 — Distribution hardening (from per-runtime review, 2026-05-29)

Verified findings from a five-agent review (one per runtime + workflow). See
`docs/runtime-support.md` for the status matrix. These constrain Tier 2, so settle
them alongside the mechanism specs.

- [x] **Dual-path helper invocation** — helper calls now resolve via
      `node "${CLAUDE_PLUGIN_ROOT}/..." 2>/dev/null || slynk-<helper>`. Env var covers the
      Claude marketplace install (the bare-command refactor had broken it); shim covers
      npm/local/Copilot. Verified both branches. _(done)_
- [ ] **Codex path fix** — installer targets `~/.codex/skills`, which Codex **ignores**.
      Real path is `~/.agents/skills`. One-line fix in `install-local.mjs`; until then "works
      on Codex" is false. Helper invocation under Codex's sandbox/approval model is unverified.
- [ ] **Prefix vs name story** — the `slynk-` dir prefix behaves differently per runtime:
      CC `slynk:` namespace, Copilot requires `name` == dirname (prefix breaks validation),
      OpenCode keys by frontmatter `name` (prefix cosmetic, no collision protection). Pick one
      coherent story. Likely belongs in the npm-distribution spec.
- [ ] **PATH reliability** — shims land in `~/.local/bin` (often not on PATH) or the npm prefix;
      installer only warns. The agent's exec shell may not inherit interactive PATH. Decide:
      fix PATH, or prefer the env-var/absolute path where available.
- [ ] **Doc drift** — README + `docs/copilot-setup.md` still describe the old
      `${CLAUDE_PLUGIN_ROOT}`-only / absolute-path model; `copilot-setup.md` omits `create-pr`
      and references a now-closed bug. Add an OpenCode install section. Drop/relocate
      `argument-hint` (Claude-only) from handoff frontmatter.
- [ ] **`handoff-context.mjs` skill scan** — scans `~/.agents/skills` but installer writes Codex
      to `~/.codex/skills` and OpenCode to `~/.config/opencode/skills`; scan dirs ≠ install dirs,
      so "Suggested Skills" is partly dead. Also misses marketplace installs (plugin cache, not
      `~/.claude/skills`).

### Tier 3 — Cleanup

- [x] **grill→spec naming leftover** — renamed `getRecentGrillDocs`→`getRecentSpecDocs` and
      `readGrillConfig`→`readSpecConfig` in `spec-context.mjs`. _(done)_
- [x] **npm distribution (local path)** — local installer (`scripts/install-local.mjs`) +
      `package.json` bin entries + Prettier/ESLint/CI shipped. npx-from-registry publish still
      pending its own spec. _(partial — local path done)_
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
