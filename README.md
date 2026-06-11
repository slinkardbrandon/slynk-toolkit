# slynk-toolkit

Reusable agent skills that empower an engineering workflow. Each skill is a
single folder driven by one `SKILL.md` -- the same file works across **Claude
Code**, **GitHub Copilot CLI**, **OpenCode**, and **Codex** (experimental).

## Skills

Skills are invoked as `slynk-brainstorm`, `slynk-spec`, `slynk-handoff`,
`slynk-create-pr`, `slynk-spec-review`, `slynk-teach`, `slynk-write-skill`, and
`slynk-skill-review` across every runtime (the installer prefixes each so the
name matches its dir).

| Skill                                 | What it does                                                                                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`brainstorm`](skills/brainstorm)     | Shapes a fuzzy idea into 2-3 approaches with tradeoffs, picks a direction, then continues into `slynk-spec` inline (or hands off a seed for a fresh session)                |
| [`spec`](skills/spec)                 | Stress-tests a plan, explores the codebase, and emits a paste-ready resume prompt before non-trivial work                                                                   |
| [`handoff`](skills/handoff)           | Captures the session (code or planning) into a standalone doc and emits a paste-ready prompt that starts a fresh agent cold                                                 |
| [`create-pr`](skills/create-pr)       | Self-reviews a branch, runs the repo's real CI checks (derived from its config), and opens a PR (GitHub) or MR (GitLab) with a human-sounding description                   |
| [`spec-review`](skills/spec-review)   | Judges whether a spec is buildable (a cold agent could implement it without guessing) and returns a PASS/BLOCKED verdict; `slynk-spec` fans it out as a gate                |
| [`teach`](skills/teach)               | Teaches a topic across sessions from a persistent teaching workspace: mission, curated resources, self-contained HTML lessons, and learning records                         |
| [`write-skill`](skills/write-skill)   | Authors a new skill the toolkit way: scaffold, router-grade description, deterministic work in `.mjs` helpers, then a mechanical check + review gate                        |
| [`skill-review`](skills/skill-review) | Judges whether a skill folder is shippable (routes, loads cross-agent, runs without guessing) and returns a PASS/BLOCKED verdict; `slynk-write-skill` fans it out as a gate |

## Install

One command, every detected agent:

```bash
npx slynk-toolkit
```

It copies each skill into the skills dir of every AI agent it finds on your
machine -- Claude (`~/.claude`), Copilot (`~/.copilot`), Codex (`~/.agents`,
experimental), OpenCode (`~/.config/opencode`) -- and templates each skill's
helper paths to absolute, so there's nothing to add to your `PATH`. A runtime is
only touched if its config dir already exists.

Then reload skills in your agent and invoke `slynk-brainstorm`, `slynk-spec`,
`slynk-handoff`, or `slynk-create-pr`.

```bash
npx slynk-toolkit --uninstall   # remove the slynk-* skills again
npx slynk-toolkit --help        # flags + detected paths
```

Re-run `npx slynk-toolkit` after a new release to update.

## Bootstrap nudge

Install also wires a machine-wide **skill-router nudge** so agents reach for a
slynk skill instead of doing the work ad-hoc. It lists only the skills actually
installed and fires every session.

| Runtime                    | Mechanism                                          |
| -------------------------- | -------------------------------------------------- |
| Claude Code                | `SessionStart` hook in `~/.claude/settings.json`   |
| Copilot / OpenCode / Codex | a managed block in that agent's global `AGENTS.md` |

The nudge is one hardcoded, opinionated variant -- no dial, no config file. To
soften or reword it, edit `hooks/bootstrap-hook.mjs` (Claude) or the block text
in `lib/installer.mjs` (others) and reinstall. To turn it off, `--uninstall` or
delete the managed region by hand -- both writers touch only the slynk-owned
block and leave your surrounding instructions intact.

## Requirements

- **Node ≥20** (the dependency-free `.mjs` helpers use `Array#toSorted`,
  which landed in Node 20).
- For `spec`: a GitHub MCP server or the `gh` CLI to auto-fetch issues (optional).
- For `create-pr`: the `gh` CLI (GitHub) or `glab` CLI (GitLab), authenticated.

See [docs/runtime-support.md](docs/runtime-support.md) for the per-runtime
status and [docs/copilot-setup.md](docs/copilot-setup.md) for Copilot specifics.

## Develop

Working from a clone? Install in `--link` mode so helper edits stay live:

```bash
npm run install:local      # node bin/slynk-toolkit.mjs --link
npm test                   # vitest specs for the installer core
npm run lint && npm run format:check
```

In `--link` mode each installed `SKILL.md` points back at the clone, so editing
a helper is reflected immediately; editing a `SKILL.md` needs a re-run.

## License

[MIT](LICENSE)
