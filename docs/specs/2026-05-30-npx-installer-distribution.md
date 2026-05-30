<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# npx Installer (Distribution)

> Spec session — 2026-05-30
> Issue: [#2](https://github.com/slinkardbrandon/slynk-toolkit/issues/2)
> Parent: docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 1.5)

## Summary

Generalize the working local installer (`scripts/install-local.mjs`) into a published
`npx slynk-toolkit` package that copies skills + their sibling helpers into each detected
agent (Claude / Copilot / OpenCode; Codex experimental), CI publishing on tag. The marketplace
and the dual-path `${CLAUDE_PLUGIN_ROOT}` / PATH-shim machinery are torn down. Helper paths are
templated to absolute at install time, which removes every PATH dependency — the load-bearing
risk in the issue dissolves rather than getting solved.

## Key Decisions

- **Single install path: `npx slynk-toolkit`.** Marketplace dropped (locked in roadmap). npx forces node, which the `.mjs` helpers need.
- **Flatten to `skills/` + `bin/` at repo root.** The `plugins/slynk/` nesting only existed for the marketplace `source: ./plugins/slynk` path.
- **`slynk-` prefix + frontmatter `name` rewrite on copy.** Install as `slynk-spec/` and rewrite frontmatter to `name: slynk-spec`. Satisfies Copilot (name == dirname), collision-safe, uniform `slynk-spec` invocation across runtimes.
- **`{{SLYNK_DIR}}` token expanded at install.** Source SKILL.md calls `node "{{SLYNK_DIR}}/spec-context.mjs"`; helper is always a SKILL.md sibling, so the token is the skill's own install dir. Copy mode -> dest dir; `--link` mode -> source clone dir.
- **Drop helper bin shims + all PATH / `~/.local/bin` logic.** Absolute templated paths mean helpers aren't PATH commands. Only `slynk-toolkit` (npx cache or npm global) stays a bin entry.
- **Codex gated experimental.** Fix path to `~/.agents/skills` so skills load, but flag helper-exec-under-sandbox as unverified in docs until tested on a real Codex install.
- **Windows-safe templating.** Emit forward-slash absolute paths (node accepts `/` on win32; avoids backslash-in-quoted-shell breakage). Copy is the Windows path; native symlink (`--link`) is best-effort dev-only (needs Developer Mode/elevation).
- **One installer.** `npm run install:local` becomes `node bin/slynk-toolkit.mjs --link`; `scripts/install-local.mjs` is removed.
- **Testable core + vitest.** Split installer into `lib/installer.mjs` (importable, injectable `home`/`runtimes`) and a thin `bin/slynk-toolkit.mjs` CLI. Real vitest specs run the core against a scratch tmp HOME so agents maintaining the repo can't silently break it.
- **Copy default, `--link` for dev, flag-driven with interactive TTY fallback, bin-only (no postinstall).** Locked.
- **Dev tradeoff accepted.** In `--link`, helper edits stay live (token points at clone) but SKILL.md edits need a re-run of install.

## Terms Clarified

- **`{{SLYNK_DIR}}`**: sentinel token in source SKILL.md, expanded by the installer to the absolute directory holding that skill's helper. Copy -> destination skill dir; `--link` -> source clone skill dir.
  _Avoid_: "the plugin root" / `${CLAUDE_PLUGIN_ROOT}` — that dual-path model is removed.
- **Templating**: the two mechanical substitutions the installer makes when writing a SKILL.md to an agent's skills dir — expand `{{SLYNK_DIR}}` and rewrite frontmatter `name:` to `slynk-<skill>`.
  _Avoid_: per-runtime content rewriting (GSD-style) — not needed; skills are portable prose.
- **Copy mode**: the published / npx default — helpers copied alongside SKILL.md into the agent's skills dir, paths absolute.
- **`--link` mode**: dev install from a clone — SKILL.md templated to point at the clone so helper edits stay live.

## Test Cases

Real vitest specs (`test/installer.test.mjs`) driving `lib/installer.mjs` against a `mkdtemp`
scratch HOME — no network, no real agent dirs touched.

- Copy install into each detected runtime produces `skills/slynk-<name>/` with frontmatter `name: slynk-<name>` and `{{SLYNK_DIR}}` expanded to that dest dir; the helper sibling exists.
- After copy, frontmatter `name` equals dirname for every skill (Copilot validation contract).
- `--link` install templates SKILL.md to the clone path; editing a helper in the clone is reflected without re-install.
- Templated paths contain no backslash (Windows-safe forward-slash assertion).
- Codex resolves to `~/.agents/skills`, never `~/.codex/skills`.
- Re-running install is idempotent (replaces, no duplicates); `--uninstall` removes only `slynk-*` entries and leaves a user's own skills untouched.
- No `{{SLYNK_DIR}}`, `CLAUDE_PLUGIN_ROOT`, or marketplace reference remains in any installed or source file (grep == 0).
- `npm pack --dry-run` ships `skills/` + `bin/` + `lib/` and excludes dev cruft; `node --check` passes on installer, core, and helpers.

## Implementation Plan

### Approach

1. Flatten `plugins/slynk/skills/` -> `skills/`; delete the `plugins/` tree and both `.claude-plugin/` files.
2. Replace the three helper bin shims with one installer; split into `lib/installer.mjs` (core) + `bin/slynk-toolkit.mjs` (thin CLI).
3. Switch SKILL.md helper calls to the `{{SLYNK_DIR}}` token; rewrite frontmatter `name` on copy.
4. Drop all PATH / `~/.local/bin` / shim logic.
5. Fix Codex to `~/.agents/skills`, gated experimental.
6. Add `files` allowlist + `prepublishOnly` (lint + tests + `node --check`) to package.json; add `.github/workflows/release.yml` publishing on `v*`.
7. Add vitest; wire `npm test` into `ci.yml` and `prepublishOnly`.
8. Rewrite README / runtime-support / copilot-setup for npx-only.

### Files to touch

- **Delete:** `.claude-plugin/marketplace.json`, `plugins/slynk/.claude-plugin/plugin.json`, `plugins/slynk/bin/slynk-*.mjs` (3 shims), `scripts/install-local.mjs`.
- **Move:** `plugins/slynk/skills/*` -> `skills/*` (helpers ride along inside each skill dir).
- `lib/installer.mjs` — new: `install`, `uninstall`, `renderSkill` (templating + frontmatter rewrite), `resolveRuntimes`; injectable `home`/`runtimes` for tests.
- `bin/slynk-toolkit.mjs` — new thin CLI: arg-parse, interactive TTY prompt fallback when no flags, delegates to core.
- `package.json` — `bin: { "slynk-toolkit": "bin/slynk-toolkit.mjs" }` (drop 3 helper shims); add `files: [skills, bin, lib, README.md, LICENSE, CHANGELOG.md]`; add `vitest` devDep; `"test": "vitest run"`; `prepublishOnly`; update scripts (`install:local` -> `node bin/slynk-toolkit.mjs --link`); bump version.
- `skills/spec/SKILL.md`, `skills/handoff/SKILL.md` — token form, drop dual-path prose; spec's write-artifact call too.
- `skills/handoff/handoff-context.mjs` — fix skill-scan dirs to match real install dirs (`~/.agents/skills`, OpenCode dir, `slynk-` prefix).
- `skills/handoff/SKILL.md` frontmatter — drop Claude-only `argument-hint`.
- `.github/workflows/release.yml` — `npm publish --access public` on `v*` tags (NODE_AUTH_TOKEN from NPM_TOKEN secret).
- `.github/workflows/ci.yml` — add `npm test` step.
- `README.md`, `docs/runtime-support.md`, `docs/copilot-setup.md`, `CHANGELOG.md` — npx-only rewrite + status refresh.
- `CLAUDE.md` — "After editing any skill" section still describes symlink-only `install:local`; update for copy-default + `--link` + the SKILL.md-edit re-run tradeoff. (Sentinel-token convention + "config over prose" principle already added this session.)

### Patterns to follow

- Helpers stay dependency-free `.mjs` resolving their own paths (CLAUDE.md helper-script rule).
- Match PR #1 portability bar: POSIX-safe, no bash-only arrays, scratch under `/tmp/slynk/`.
- `ci.yml` style for `release.yml` (actions/checkout@v4 + setup-node@v4, node 22).
- Path-based runtime detection with env overrides, present only if config dir exists (carried from `install-local.mjs`).

### How to verify

- Run core against a scratch HOME with fake runtime dirs; assert the trees above (vitest).
- `grep -r` for `{{SLYNK_DIR}}` / `CLAUDE_PLUGIN_ROOT` / marketplace refs returns nothing.
- `npm test && npm run lint && npm run format:check` pass; `npm pack --dry-run` file list correct.

### Assumptions

- Codex `~/.agents/skills` is correct (verified in runtime-support.md); helper exec under its sandbox stays untested until a real Codex install.
- npm name `slynk-toolkit` is available (registry 404 confirmed) and an `NPM_TOKEN` repo secret is added before the first tag.
- No per-runtime content adaptation needed beyond dropping Claude-only `argument-hint`.
