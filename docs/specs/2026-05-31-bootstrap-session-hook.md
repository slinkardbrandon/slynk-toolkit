<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# Bootstrap Session Hook (Skill Router)

> Spec session -- 2026-05-30
> Issue: [#3](https://github.com/slinkardbrandon/slynk-toolkit/issues/3)
> Parent: docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 1, bootstrap session hook)
> Reviewed: CC hook contract, cross-agent capabilities, spec quality (3 agents, 2026-05-31)

## Summary

Ship superpowers' session-bootstrap mechanism without its ceremony or its config
surface. One hardcoded, aggressive skill-router nudge, auto-installed machine-wide
by the toolkit installer into every detected agent. On Claude Code it's a
SessionStart hook (a guaranteed-fired event). On Codex/OpenCode/Copilot-CLI it's a
slim sentinel-delimited block in each agent's global `AGENTS.md`. No dial, no
`.slynk.yml`, no env var. "Dial back" = edit the source text and re-run install.

## Key Decisions

- **No config, no dial.** One hardcoded aggressive nudge. Supersedes the issue's
  locked "default suggest, dialable to force" -- Brandon dropped the dial mid-spec
  (lightweight-by-default + YAGNI on knobs). Adjust = edit source, reinstall.
- **Aggressive, not persuasion-table.** Strong/directive ("route proactively, don't
  wait to be asked"), but none of superpowers' "1% of cases" / MUST theatrics.
- **Auto-on, machine-wide, all agents.** Installer writes to each detected runtime's
  global config; fires every session. Off-ramp = uninstall or delete the block. The
  cross-repo nag is accepted on purpose (maximize exposure).
- **Two delivery mechanisms, one message.** CC = SessionStart hook (hard, fires
  deterministically). Others = global `AGENTS.md` block (soft, model reads it as
  standing guidance). Parity is approximate by design: the hook is mechanically
  stronger, but the nudge is soft either way so it's fine.
- **AGENTS.md block must be slim + high-value.** Succinct, no context bloat, no
  interference with the user's other instructions. Reference the skills for detail,
  don't inline it. Goal: the user _wants_ to keep the block. (Brandon, this session)
- **Curated routes, availability-gated.** The trigger->skill table is curated (the
  hard part = trigger discrimination); a row is emitted only if that `slynk-*` skill
  is actually installed.
- **Hook/block script location.** copy mode -> `<agent-config>/slynk/bootstrap-hook.mjs`;
  link mode -> the clone. CC `settings.json` references it by absolute `node "<path>"`,
  mirroring the `{{SLYNK_DIR}}` philosophy.
- **`.slynk.yml` killed; unified-config item retired.** `.spec.yml` stays standalone,
  owned by the spec skill. One config file owned by one skill = nothing to unify, so
  the unified-config Tier-1 roadmap item is retired, not rewritten.

## Terms Clarified

- **Bootstrap nudge**: the hardcoded router text injected at session start. Single
  aggressive variant; no suggest/force/off modes.
  _Avoid_: "bootstrap mode" / "the dial" -- that suggest|force|off design was dropped.
  This term **replaces** the "Bootstrap mode" entry currently in CONTEXT.md.
- **Skill router**: the curated trigger->skill mapping (fuzzy idea -> `slynk-brainstorm`;
  ready to build -> `slynk-spec`; shipping -> `slynk-create-pr`; wrapping up -> `slynk-handoff`).
- **Managed block**: the installer-owned, sentinel-delimited region in a target file
  (a JSON hook entry in CC `settings.json`; a markdown comment block in `AGENTS.md`).
  Located by sentinel so reinstall is idempotent and uninstall removes only ours.
- **AGENTS.md**: the de-facto cross-tool Markdown instructions file Codex/OpenCode/
  Copilot-CLI read as standing guidance. Claude Code does NOT read it (uses CLAUDE.md),
  which is why CC gets the hook and the others get the AGENTS.md block.

## Draft nudge text (the deliverable -- react/edit freely)

Same message, two renderings. Keep both slim (CC budget is 10k chars, but the point
is to stay lean). Only routes whose skill is installed appear.

**CC hook** (`additionalContext`):

> slynk skills are installed. Route the user's intent to a skill instead of doing
> the work ad-hoc -- they encode how this user works:
> fuzzy/unshaped idea -> slynk-brainstorm; ready to build something non-trivial -> slynk-spec;
> changes ready to ship -> slynk-create-pr; wrapping up or low on context -> slynk-handoff.
> Reach for these proactively; when a moment plausibly fits, invoke rather than ask.

**AGENTS.md block** (slim, markdown, references skills for detail):

```markdown
<!-- slynk:bootstrap:start (managed by slynk-toolkit; edit via reinstall) -->

## slynk skills

Prefer a slynk skill over ad-hoc work when the moment fits:
fuzzy idea -> slynk-brainstorm, ready to build -> slynk-spec, shipping -> slynk-create-pr,
wrapping up -> slynk-handoff. See each skill for detail.

<!-- slynk:bootstrap:end -->
```

## Implementation Plan

### Approach

1. Ship a dependency-free hook script that emits the router nudge as SessionStart
   context, listing only installed `slynk-*` routes.
2. Build a safe managed-block writer in the installer:
   - CC: merge a SessionStart entry into global `settings.json` (JSON).
   - Codex/OpenCode/Copilot-CLI: upsert a markdown block into each global `AGENTS.md`.
   - Both idempotent, atomic, reversible, claude-hook is claude-only.
3. Wire install/uninstall; print per-runtime status.
4. Reconcile docs: CONTEXT.md glossary, roadmap, issue #3.

### CC settings.json merge (net-new -- the hard part)

The installer today is pure directory copy/rm; there is **no** JSON-merge prior art
to reuse. This is new code and the riskiest surface (writing a user-owned global file).

- **Read -> parse -> upsert -> atomic write.** Parse `settings.json`; locate or create
  `hooks.SessionStart`; upsert the slynk entry; write to a temp file in the same dir
  then `renameSync` over the target (atomic on one filesystem).
- **Symlink-safe.** If `settings.json` is a symlink (dotfiles repos), resolve realpath
  and rename onto the real file so the link isn't replaced with a regular file.
- **Idempotency predicate (JSON has no comments):** match the SessionStart entry whose
  command path ends in `slynk/bootstrap-hook.mjs`. Path-based, version-stable -- a
  future hook-shape change still finds and replaces the old entry instead of duplicating.
- **Hook entry shape:**
  ```json
  { "type": "command", "command": "node \"<abs>/slynk/bootstrap-hook.mjs\"", "timeout": 10 }
  ```
  wrapped in a `{ "hooks": [ ... ] }` matcher object under `SessionStart`. Omit the
  matcher field so it fires on all session sources (startup/resume/clear/compact),
  consistent with "fire aggressively." (Watch-point: resume/compact re-fire; revisit
  if noisy.)
- **Malformed settings.json:** `JSON.parse` fails on JSON5/comments/trailing commas
  (which CC itself tolerates). On parse failure: **skip the CC hook, still install
  skills + other agents, print a one-line manual-add instruction.** Never clobber.

### AGENTS.md block writer (easier -- markdown has comments)

- Upsert the region between `<!-- slynk:bootstrap:start ... -->` and `<!-- ...:end -->`.
  Present -> replace between markers; absent -> append; uninstall -> strip the region.
- Same atomic temp+rename + symlink handling.
- Append-only otherwise: never reorder or touch the user's surrounding instructions.

### Hook script runtime behavior

- **Location-independent.** Runs from `<agent-config>/slynk/`, not the project. Find
  installed skills by scanning the sibling skills dir relative to its own location
  (resolve from `import.meta.url`), not `cwd`. Reuse `CLAUDE_CONFIG_DIR` if set.
- **Availability gating:** emit a route line only for an installed `slynk-*` skill.
  **Zero slynk skills found -> emit nothing** (no empty/garbage nudge).
- **Fail-open:** any error -> exit 0 with no output. Never exit 2 (stderr would spam
  the user); never block session start.

### Files to touch

- `hooks/bootstrap-hook.mjs` (new) -- dependency-free; scans installed `slynk-*`
  skills, prints SessionStart JSON (`hookSpecificOutput.additionalContext`), gated.
- `package.json` -- add `"hooks"` to the `files` array, or the script won't ship in
  the npx tarball. (Copy-mode currently only walks `skills/*` -- see installer below.)
- `lib/installer.mjs` -- add the managed-block writers (`writeCcHook`/`writeAgentsBlock`
  - removers), atomic+symlink-safe; copy the hook script into each runtime's `slynk/`
    dir (copy mode) or reference the clone (link mode) -- a path **outside** the existing
    `skills/*` copy loop, so it's an explicit new step. Wire into `install()`/`uninstall()`.
- `bin/slynk-toolkit.mjs` -- invoke the writers; per-runtime status line
  (e.g. "claude: hook installed", "codex: AGENTS.md nudge written").
- `test/installer.test.mjs` -- the test cases below (drive against a scratch HOME).
- `README.md` -- bootstrap section: what's auto-installed per agent, that the nudge is
  machine-wide, and how to disable (uninstall or delete the block).
- `CONTEXT.md` -- replace the "Bootstrap mode" glossary entry with "Bootstrap nudge".
- `docs/specs/2026-05-29-slynk-roadmap-mechanisms.md` -- mark dial dropped; retire the
  unified-config item; add `slynk init` stretch goal (note OpenCode plugin API as the
  near-term automation target; carry the Codex sandbox-exec caveat forward).
- Issue #3 -- comment noting the dial reversal so an implementer isn't misled.

### Test cases (validated direction; correct me if intent is off)

- CC hook is written into a scratch `settings.json` while preserving pre-existing keys
  and unrelated hooks (incl. a user's own SessionStart entry).
- Re-running install is idempotent -- no duplicate slynk entries.
- Idempotent across a **changed** entry: an older slynk hook (different command shape,
  same `slynk/bootstrap-hook.mjs` path) is replaced, not duplicated.
- Uninstall removes only the slynk hook; the user's other hooks/settings survive.
- Atomicity: a simulated write failure leaves the original `settings.json` intact.
- Symlinked `settings.json` stays a symlink after write.
- Malformed `settings.json` -> CC hook skipped, skills still install, no clobber.
- AGENTS.md block: created when absent, replaced in place when present (no dupes),
  stripped on uninstall, surrounding user content untouched.
- AGENTS.md write is global per detected agent; CC hook is claude-only.
- Hook script emits valid SessionStart JSON with `additionalContext`.
- Availability gating: only `slynk-spec` installed -> nudge lists spec only.
- Zero slynk skills -> hook emits nothing.
- link vs copy: link mode points the command at the clone; copy mode at
  `<agent-config>/slynk/bootstrap-hook.mjs`.

### Patterns to follow

- Dependency-free `.mjs`, resolve own paths via `import.meta.url`, no hardcoded install
  path (CLAUDE.md).
- Injectable `home`/`env`/`runtimes` so vitest drives against a scratch HOME without
  touching a real agent install (existing installer test pattern).
- Idempotent + reversible side effects, mirroring `uninstall()` removing only `slynk-*`.
- New rule for this feature: every write into a user-owned file is atomic (temp+rename),
  symlink-aware, and append/upsert-only -- never a full rewrite.

### How to verify

- `npm test` green.
- `npm run install:local`; inspect `~/.claude/settings.json` for the managed hook and
  each detected `AGENTS.md` for the block; start a fresh Claude session, confirm the
  nudge appears.
- `npm run uninstall:local` removes the hook and the blocks, leaving surrounding
  content intact.

### Assumptions / watch-points

- **CC SessionStart contract verified** (review): JSON `hookSpecificOutput.additionalContext`,
  10k-char cap, set `"timeout": 10`, omit matcher to fire on all sources, exit 0 on
  failure. Re-confirm field name at build (2-min doc check) before coding.
- **AGENTS.md paths to confirm at build** (review flagged medium confidence; tools move
  fast): Codex `~/.codex/AGENTS.md` (config lives in `CODEX_HOME`=`~/.codex`, NOT the
  `~/.agents` skills dir); OpenCode `~/.config/opencode/AGENTS.md`; Copilot-CLI
  `~/.copilot/AGENTS.md`. Note: Copilot **CLI** uses AGENTS.md -- `.github/copilot-instructions.md`
  is the separate VS Code product; don't target it here.
- **Trigger discrimination is unsolved by design.** The nudge fires every session,
  including pure "just answer me" Q&A. Aggressive on purpose; if it over-fires, edit
  the text to add a direct-question caveat. The #1 thing to watch post-ship.
- **Codex sandbox exec** (runtime-support.md): an absolute `node <path>` call may hit
  an approval prompt under Codex's sandbox. The CC hook is CC-only so this doesn't bite
  v1, but it gates any future Codex hook automation -- carried into the `slynk init` note.
