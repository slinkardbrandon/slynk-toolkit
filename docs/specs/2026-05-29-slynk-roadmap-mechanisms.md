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

- **Distribution:** `npx slynk-toolkit` is the **single** install path — the Claude marketplace is
  dropped. npx forces node, which guarantees the `.mjs` helpers/shims always run, and collapses the
  two-model straddle that broke the marketplace path. Consequences (fold into the npm build, don't
  churn code now): bare commands everywhere → drop the `${CLAUDE_PLUGIN_ROOT}` dual-path branch;
  remove `marketplace.json` + `plugin.json`; consider flattening `plugins/slynk/skills/` → `skills/`.
  Cost: lose `claude plugin update` auto-update (replaced by re-running npx). (Proven by GSD shipping
  to 15 runtimes, npx-only.)
- **Bootstrap:** ship one hardcoded, aggressive skill-router nudge -- **no dial** (dropped mid-spec:
  lightweight-by-default + YAGNI on knobs; adjust by editing the source and reinstalling). A CC
  SessionStart hook fires it deterministically on Claude; a slim `AGENTS.md` block carries it on
  Codex/OpenCode/Copilot-CLI. Core to the offering -- it's the discovery layer for the whole skill set.
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
- **Repo scope:** `slynk-ai-toolkit` is **skills + workflow**, period. A tool-abstraction / MCP layer
  (e.g. a "slynk ticket MCP" that uniformly maps Jira / Trello / GitHub Issues) is a **separate slynk
  repo** if ever pursued, not in scope here. Rationale: an MCP server is a running process with
  lifecycle/config/creds — a different animal from prose skills + dependency-free `.mjs` helpers.
  Skills orchestrate and call uniform helpers; they don't ship servers.

## Terms Clarified

- **Mechanism vs ceremony**: a _mechanism_ is reusable plumbing (bootstrap hook, task-list
  convention, subagent fanout). _Ceremony_ is mandatory process layered on top (forced gates,
  required artifacts). slynk adopts mechanisms; it rejects forced ceremony.
  _Avoid_: using "superpowers-style" to mean both at once.
- **Bootstrap nudge**: the single hardcoded skill-router text injected at session start. One
  aggressive variant -- no suggest/force/off modes (the dial was dropped).
  _Avoid_: "bootstrap mode" / "the dial" -- that design is retired.
- **Mindset lens** (`/tdd`): a short reference skill that shapes _how to think about what to test_,
  invoked to influence planning — not a skill that writes or runs tests.
  _Avoid_: "the TDD skill" implying an executor.
- **Work classification** (in `/spec`): bug | feature | chore/config | ticket-only. Drives whether
  `/tdd` is pulled in (bug/feature → yes; chore/ticket-only → skip).

## Roadmap

### Tier 1 — Mechanisms (settle first; they constrain every skill's shape)

Independent of each other; npm distribution shipped, the rest pending:

- [x] **npm distribution** — `npx slynk-toolkit` shipped (#7, #8): copies each skill into every
      detected agent, `{{SLYNK_DIR}}`-templated helper paths, marketplace dropped. Design:
      `docs/specs/2026-05-30-npx-installer-distribution.md`.
- [ ] **bootstrap session hook (skill router)** → `docs/specs/2026-05-31-bootstrap-session-hook.md` _(specced -- ready to build)_
  - One hardcoded, aggressive skill-router nudge auto-installed into every detected agent. **No dial,
    no `.slynk.yml`** -- dropped mid-spec (lightweight-by-default + YAGNI on knobs; adjust by editing
    the source and reinstalling).
  - **Delivery:** CC SessionStart hook (fires deterministically) + a slim sentinel-delimited `AGENTS.md`
    block on Codex/OpenCode/Copilot-CLI (Claude reads `CLAUDE.md`, not `AGENTS.md`). One message, two mechanisms.
  - **Curated, availability-gated routes** (fuzzy → `slynk-brainstorm`; ready → `slynk-spec`; shipping
    → `slynk-create-pr`; wrapping up → `slynk-handoff`); a row emits only if that skill is installed.
    Hard part is trigger discrimination -- the skill descriptions already carry it.
  - **Core to the offering** -- it's the discovery layer that makes the whole skill set get reached for.
- [ ] **todo-list convention** → `docs/specs/<date>-todo-convention.md` _(not yet written)_
  - Shared convention: skills with checklists instruct the agent to create a `TodoWrite` task per item.
  - Open questions: where the convention lives (shared reference? per-skill?); graceful degradation to
    markdown checklist on agents without the tool; which skills opt in.
- [x] ~~**unified config + shared loader**~~ -- **retired.** The bootstrap spec killed `.slynk.yml`;
      `.spec.yml` stays standalone, owned by the spec skill. One config owned by one skill = nothing to
      unify. (See `docs/specs/2026-05-31-bootstrap-session-hook.md`.)
- [ ] **research fanout mechanism** → _deferred; inline in `/brainstorm` for now_
  - Capability-gated convention for dispatching parallel research subagents that burn _their_
    context (codebase / tickets / web) and return **distilled, cited** findings, keeping the primary
    runner lean. CONTEXT.md already names "subagent fanout" as a mechanism.
  - **Not a shared mechanism yet (YAGNI).** Lives inline in `/brainstorm`'s SKILL.md (its first and
    only consumer). Extract to a shared mechanism only when a second consumer (`/spec`, `pr-review`)
    needs it — the dispatch + distill contract is written so it can be lifted out cleanly.
  - **Cross-agent gating (load-bearing):** parallel subagents work on **both Claude Code and Copilot**
    (different primitives — CC's Task tool + background tasks; Copilot's own agent mechanism); Codex/
    OpenCode TBD. Detect the runtime's primitive and dispatch the right way; degrade to inline research
    or skip where none exists. The consuming skill must stay fully functional text-only.
  - **Derive sources, don't invent:** offer only sources reachable in _this_ env (codebase always;
    web if web tools exist; Jira/Confluence/GitHub only if MCP/CLI configured).
  - **Async model:** background-while-work where supported (continue synchronous Q&A, fold findings as
    they land); launch-and-await fallback. Dispatch prompt forces distilled output (claim + source),
    never raw dumps — or the mechanism defeats its own context-hygiene purpose.

Then, depends on todo-convention + bootstrap:

- [x] **/brainstorm (divergent ideation front-end)** — built in #11. Divergent front-end to `/spec`
      (fuzzy idea → shape into 2-3 approaches → gate → inline `slynk-spec` handoff or paste-ready seed),
      with inline, capability-gated research fan-out. Full design: `docs/specs/2026-05-30-brainstorm-skill.md`.
  - **Pending dogfood:** run `/brainstorm` on the "uniform tools layer" question — a uniform
    research-source layer (helpers first, MCP only for autonomous calls), orchestration staying prose
    per-runtime? Fuzzy + research-heavy, so it exercises both the skill and the fan-out. If it points to
    a real tool/MCP abstraction, that's a separate slynk repo (see Repo scope above).
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

### Tier 2 — Missing skills

**Prerequisite for pr-review/pr-triage:** collect the user's current flavors off his machines and
transcribe the real patterns — do not invent. `spec-review` is less blocked: its primary input (the
`/spec` artifact format) already lives in this repo, and the fan-out triage pattern was exercised in
this session's five-agent runtime review. These are reviewer/author-side companions to the existing
`spec`/`handoff`/`create-pr`.

- [ ] **spec-review** → `docs/specs/<date>-spec-review.md` _(not yet written)_
  - Reviews a `/spec` artifact for **quality**, not intent-fit: inconsistencies, tone, redundancy,
    wordiness, accuracy, completeness — and surfaces missed concerns. It's the critic to `/spec`'s
    author; reviews `/spec`'s own output.
  - Works on the user's specs, other people's specs, or via **agent fan-out** for independent triage
    (each agent pressure-tests the spec from a different lens, then synthesize — the pattern used in
    this session's runtime review).
  - **Distinct from the machine-local `review-spec` skill**, which judges intent-fit (does the design
    solve the ticket?). This one judges the artifact's quality. Don't conflate — different surface.
  - Reuses `/spec`'s tone rules (CLAUDE.md: no AI-isms, no em-dashes, concise) as review criteria.
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
- [ ] **`/handoff` durable / cross-machine gap** _(dogfooding insight)_ — `/handoff` writes only to
      `{tmpDir}/handoff/`, which is machine-local and lost on `git pull`, so it can't carry work to
      another machine. GitHub issues fill that gap — and `/spec <issue>` already consumes them, so
      "file the handoff as an issue" closes a natural loop. Candidate: a `/handoff --issue` (or in-repo)
      mode. Surfaced when these roadmap next-steps needed to travel cross-machine and tmp wouldn't do.

### Tier 1.5 — Distribution hardening (from per-runtime review, 2026-05-29)

Verified findings from a five-agent review (one per runtime + workflow). See
`docs/runtime-support.md` for the status matrix. These constrain Tier 2, so settle
them alongside the mechanism specs.

Most of this shipped with the npx installer (#7, #8); `docs/runtime-support.md` is the live matrix.

- [x] **Marketplace dropped + PATH made moot** — `#7`/`#8`. Removed `.claude-plugin/`, `plugins/`, and
      the `${CLAUDE_PLUGIN_ROOT}` dual-path; flattened to top-level `skills/`; helpers resolve by
      absolute path via the `{{SLYNK_DIR}}` token, so the PATH-shim risk no longer exists.
- [x] **Codex path fix** — installer targets `~/.agents/skills` (`#7`). Helper exec under Codex's
      sandbox is still unverified (see runtime-support).
- [x] **Prefix vs name story** — settled: the installer prefixes `slynk-` and rewrites frontmatter
      `name` to match on every runtime.
- [ ] **Doc drift** — partly done (runtime-support + README rewritten for npx). Open: `copilot-setup.md`
      staleness, and `argument-hint` (not universally supported) still in spec/create-pr/brainstorm frontmatter.
- [ ] **`handoff-context.mjs` skill scan** — scans `~/.agents/skills` only; installer also writes
      `~/.claude`, `~/.copilot`, `~/.config/opencode`, so "Suggested Skills" is partly dead.

### Tier 3 — Cleanup

- [x] **grill→spec naming** — `getRecentGrillDocs`/`readGrillConfig` renamed in `spec-context.mjs`.
- [x] **npm distribution** — local installer, bin entries, Prettier/ESLint/CI, then the npx installer
      shipped (#7, #8); design in `docs/specs/2026-05-30-npx-installer-distribution.md`.
- [x] **PR #1 hardening** — merged (#1): BSD grep secrets bug, dash-safe arrays, apostrophe-safe
      spec-write, `/tmp/slynk/` namespacing, `master→main` fallback, CHANGELOG.

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
