# Changelog

All notable changes to this project are documented here. Versions follow
[semver](https://semver.org/); tagged releases (`vX.Y.Z`) mark each cut.

## [1.1.0] — 2026-05-30

npx-based distribution. Single install path; marketplace and the dual-path
helper machinery removed.

### Added

- **`npx slynk-toolkit`** installer: copies skills into every detected agent
  (Claude, Copilot, Codex, OpenCode), templating each skill's helper paths to
  absolute. `--link` for dev installs from a clone, `--uninstall` to remove,
  `--help` for flags. Bin entry only — no postinstall hook.
- **`lib/installer.mjs`** importable core (`renderSkill`, `resolveRuntimes`,
  `install`, `uninstall`) with injectable `home`/`env`/`runtimes`, plus vitest
  specs (`test/installer.test.mjs`) that drive it against a scratch HOME.
- `.github/workflows/release.yml` — `npm publish` on `v*` tags; `npm test`
  added to CI and as a `prepublishOnly` gate.

### Changed

- Skills moved from `plugins/slynk/skills/` to top-level `skills/`.
- SKILL.md helper calls use the `{{SLYNK_DIR}}` token (expanded to the skill's
  absolute install dir at install time) instead of the
  `${CLAUDE_PLUGIN_ROOT}` / PATH-shim dual path.
- Skills install as `slynk-<name>/` with frontmatter `name:` rewritten to match
  the dir — uniform `slynk-<name>` invocation, and Copilot's name-equals-dirname
  contract is satisfied.
- Codex now targets `~/.agents/skills` (was `~/.codex/skills`, which Codex
  ignores); flagged experimental until helper exec under its sandbox is verified.
- `npm run install:local` is now `node bin/slynk-toolkit.mjs --link`.

### Removed

- Claude marketplace (`.claude-plugin/marketplace.json`,
  `plugins/slynk/.claude-plugin/plugin.json`), the three `slynk-*` bin shims,
  `scripts/install-local.mjs`, and all `${CLAUDE_PLUGIN_ROOT}` / `~/.local/bin`
  PATH logic.
- `handoff`'s Claude-only `argument-hint` frontmatter.

## [1.0.1] — 2026-05-29

Robustness, portability, and discoverability pass. No new skills.

### Fixed

- **handoff:** `handoff-context.mjs` now enumerates plugin-installed skills
  (via `~/.claude/plugins/installed_plugins.json`), not just the standalone
  `~/.claude|.copilot|.agents/skills` dirs — so "Suggested Skills" is no longer
  empty for the plugin install path.
- **spec:** `write-spec-artifact.mjs` no longer crashes (and lose the piped-in
  spec content) when git `user.name`/`user.email` are unset; it degrades to
  `unknown`.
- **spec:** `spec-context.mjs` default-branch detection is local-first
  (`git symbolic-ref refs/remotes/origin/HEAD`) and falls back to `main`, not
  `master`.
- **spec:** the config (`.spec.yml`) parser strips inline `# comments` and
  surrounding quotes from values.
- **create-pr:** secrets-scan grep uses POSIX `[[:space:]]` instead of `\s`
  (the PCRE form silently matched a literal `s` on BSD/macOS grep, missing
  secrets).
- **create-pr:** Wave-2 parallel checks capture each check's real exit code and
  no longer rely on bash-only arrays (works under `sh`/dash).
- **create-pr:** default-branch detection is local-first instead of the
  network- and locale-dependent `git remote show origin | sed`.
- **create-pr:** `require('./package.json')` for the beachball change file now
  resolves against `$REPO_ROOT`.
- **create-pr:** non-interactive commit-squash guidance replaces blind
  `git rebase -i` (which an agent runtime can't drive).
- **docs:** `docs/copilot-setup.md` now includes `create-pr` in the symlink and
  Windows-copy instructions.

### Changed

- All skill scratch files are namespaced under `/tmp/slynk/<skill>/` with a
  per-run `mktemp -d` subdir, and cleaned up with a scoped `rm` (no more greedy
  `rm -f /tmp/pr_check_*`). handoff output moved to `<os-tmp>/slynk/handoff/`.
- **spec:** writes its artifact via a scratch file + `--content <file>` instead
  of `echo '<content>' | …` (which broke on apostrophes/newlines).
- **create-pr:** GitLab MR creation documents `--description-file` as the
  preferred form.
- **Descriptions:** `spec` and `handoff` now have disjoint triggers and mutual
  "not for X — use the other" pointers so the right one fires; `handoff` leads
  with the `/compact` contrast. Added `argument-hint` to `spec` and `create-pr`
  and shortened `handoff`'s to a noun phrase.
- **docs:** README/plugin README state **Node ≥18** and accurately describe
  Copilot path resolution (the agent substitutes the skill dir; nothing
  "computes its own directory").
- **handoff:** clipboard one-liners mention `xsel`/`wl-copy` (Wayland)
  alternatives to `xclip`.

## [1.0.0] — 2026-05-29

Initial release: the `slynk` plugin bundling three dual-target agent skills
(Claude Code + GitHub Copilot CLI):

- **spec** — stress-test a plan before building.
- **handoff** — capture a session into a standalone doc for a fresh agent.
- **create-pr** — self-review a branch, run the repo's real CI checks, and open
  a PR (GitHub) or MR (GitLab).

[1.1.0]: https://github.com/slinkardbrandon/slynk-toolkit/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/slinkardbrandon/slynk-toolkit/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/slinkardbrandon/slynk-toolkit/releases/tag/v1.0.0
