# Changelog

All notable changes to this project are documented here. Versions follow
[semver](https://semver.org/); tagged releases (`vX.Y.Z`) mark each cut.

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

[1.0.1]: https://github.com/slinkardbrandon/slynk-toolkit/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/slinkardbrandon/slynk-toolkit/releases/tag/v1.0.0
