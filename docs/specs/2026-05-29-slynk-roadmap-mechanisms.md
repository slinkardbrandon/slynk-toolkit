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
  - **Scope-in (config convergence):** `.slynk.yml` is **the shared toolkit config**, not a
    bootstrap-only file. Define it here as the single config every skill reads, with `bootstrap`
    as its first key. The shared loader helper is the unified-config item below.
  - Open questions: exact preamble wording per mode; how `force` language reads without superpowers'
    persuasion-table heaviness; per-agent delivery (hook vs AGENTS.md vs instructions files).
  - **Workflow review steer:** `force` is the highest ceremony risk and has no natural trigger
    (set-once-and-forget; nags on unrelated sessions). Keep `suggest`/`off` as the real product;
    treat `force` as a de-emphasized escape hatch, and scope its language to skill-relevance, not a
    blanket "you MUST check skills" on every session start.
  - **Scope-in (skill router):** `suggest` is not a limp "skills exist, go look" one-liner. It's a
    **situational router** that strongly encourages reaching for the right skill at the right moment
    (fuzzy idea → `/brainstorm`; ready to build → `/spec`; wrapping up → `/create-pr`). This is the
    superpowers pre-injected-bootstrap value, minus the MUST. **Hard part = trigger discrimination:**
    "whenever it makes sense" must distinguish a brainstorm-worthy moment from a just-answer-me
    question, or `suggest` becomes over-eager. Nailing the triggers matters more than the wording.
- [ ] **todo-list convention** → `docs/specs/<date>-todo-convention.md` _(not yet written)_
  - Shared convention: skills with checklists instruct the agent to create a `TodoWrite` task per item.
  - Open questions: where the convention lives (shared reference? per-skill?); graceful degradation to
    markdown checklist on agents without the tool; which skills opt in.
- [ ] **unified config + shared loader** → `docs/specs/<date>-unified-config.md` _(not yet written)_
  - One `.slynk.yml` read by (almost) every skill via a shared dependency-free loader helper, so
    repeatable setup is config-driven, not restated per `SKILL.md`. Folds today's `.spec.yml` into it.
  - **Introduced by the bootstrap dial** (which defines `.slynk.yml`); generalized into the shared
    loader here. Principle: config over prose, scripts over tokens (see `CLAUDE.md`).
  - Open questions: loader location + how skills locate it (`{{SLYNK_DIR}}` sentinel); precedence
    (repo vs home); migration of `.spec.yml`; which keys each skill owns.
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

- [x] **/brainstorm (divergent ideation front-end)** → `docs/specs/2026-05-30-brainstorm-skill.md` _(built: `skills/brainstorm/`)_
  - The divergent front-end to `/spec`. Pipeline: vague idea → `/brainstorm` (diverge, shape, pick a
    direction) → `/spec` (poke holes, produce implementable artifact) → implement → `/create-pr`.
    slynk's answer to superpowers' `brainstorm`, where `/spec` is their `writing-plans` half.
  - **Two-layer ceremony:** firm discipline _inside_ the skill (one question-cluster at a time, force
    2-3 approaches + a recommendation, gate — no code/spec-handoff until shaped and approved). The
    global nudge lives in the bootstrap router, not here. **Drop** the universal overreach ("every
    project regardless of simplicity") and the 1%/MUST tone. Firm and directive ≠ shouty.
  - **Opt-in, never a pre-gate.** Fires when the moment is fuzzy; must never auto-front-run all work.
  - **No durable doc; seeds `/spec`.** The seed IS `/spec`'s inline description (a paste-ready prompt
    with fixed sections: chosen direction, approaches considered, research findings, new terms) -- so
    `/spec` needs no code change. Gate has explicit exit criteria (2-3 approaches + named direction +
    user approval) plus a user-override ramp. Visual = mermaid/ascii inline, not a browser server.
  - **Research fan-out inline (v1):** when a question raises a research angle, offers specific targets
    (code/tickets/web) for a one-line approval -- at most once per roundtrip, never once per session,
    never silent auto-fire (launch only after the offer is accepted). Capability-gated by observable
    tool presence (not runtime brand); distilled findings fold into the seed. Text-only works everywhere.
    Firm and concrete, not shouty.
  - **Helpers + deps:** reuse `spec-context.mjs` for Phase-0 context; add `brainstorm-sources.mjs` to
    probe reachable sources (gh/glab/MCP/git). Uses the todo-list convention for its multi-step flow
    where supported, degrading to a markdown checklist. Full design: `docs/specs/2026-05-30-brainstorm-skill.md`.
  - **Inaugural dogfood topic (candidate):** once `/brainstorm` ships, run it on the "uniform tools
    layer" question — should slynk offer a uniform research-source layer (helpers first, MCP only for
    autonomous calls), with orchestration staying prose per-runtime? Fuzzy + research-heavy (needs the
    per-platform MCP-support matrix verified), so it dogfoods both the skill and the fan-out. If it
    points toward a real tool/MCP abstraction, that's a separate slynk repo (see Repo scope above).
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

- [x] **Dual-path helper invocation** — _interim._ Helper calls resolve via
      `node "${CLAUDE_PLUGIN_ROOT}/..." 2>/dev/null || slynk-<helper>`, restoring the marketplace
      path the bare-command refactor broke. **Now superseded:** dropping the marketplace (see Key
      Decisions) means `${CLAUDE_PLUGIN_ROOT}` never exists, so the npm build simplifies these back
      to plain bare commands. Leave the dual-path in place until then — it's harmless. _(done, to be simplified)_
- [ ] **Drop the marketplace** — remove `.claude-plugin/marketplace.json` + `plugins/slynk/.claude-plugin/plugin.json`,
      simplify dual-path helper calls back to bare commands, update README. Consider flattening
      `plugins/slynk/skills/` → `skills/`. Part of the npm-distribution spec.
- [ ] **Codex path fix** — installer targets `~/.codex/skills`, which Codex **ignores**.
      Real path is `~/.agents/skills`. One-line fix in `install-local.mjs`; until then "works
      on Codex" is false. Helper invocation under Codex's sandbox/approval model is unverified.
- [ ] **Prefix vs name story** — `slynk-` dir prefix behaves differently per runtime. With the
      marketplace gone the CC `slynk:` namespace is moot; remaining tension is Copilot (requires
      `name` == dirname, so prefix breaks validation) vs OpenCode (keys by frontmatter `name`, prefix
      cosmetic). Pick one coherent story in the npm-distribution spec.
- [ ] **PATH reliability** — the real remaining distribution work. Shims land in `~/.local/bin`
      (often not on PATH) or the npm prefix; installer only warns, and the agent's exec shell may not
      inherit interactive PATH. With no marketplace/env-var fallback, getting shims reliably on PATH
      is load-bearing. npm global bin-link handles the global-install case; solve the local case too.
- [ ] **Doc drift** — README + `docs/copilot-setup.md` describe the old `${CLAUDE_PLUGIN_ROOT}` /
      marketplace model. Rewrite for npx-only. Add an OpenCode install section. `copilot-setup.md`
      omits `create-pr` and references a now-closed bug. Drop/relocate `argument-hint` (Claude-only)
      from handoff frontmatter.
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
