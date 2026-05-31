# slynk-toolkit

Reusable agent skills that empower an engineering workflow. Each skill is a
single folder driven by one `SKILL.md` -- the same file works across **Claude
Code**, **GitHub Copilot CLI**, **OpenCode**, and **Codex** (experimental).

## Skills

Four skills, invoked as `slynk-brainstorm`, `slynk-spec`, `slynk-handoff`, and
`slynk-create-pr` across every runtime (the installer prefixes each so the name
matches its dir).

| Skill                             | What it does                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`brainstorm`](skills/brainstorm) | Diverges on a fuzzy idea into 2-3 approaches with tradeoffs, recommends a direction, and on approval emits a paste-ready seed for `/spec`                 |
| [`spec`](skills/spec)             | Stress-tests a plan, explores the codebase, and emits a paste-ready resume prompt before non-trivial work                                                 |
| [`handoff`](skills/handoff)       | Captures the session (code or planning) into a standalone doc and emits a paste-ready prompt that starts a fresh agent cold                               |
| [`create-pr`](skills/create-pr)   | Self-reviews a branch, runs the repo's real CI checks (derived from its config), and opens a PR (GitHub) or MR (GitLab) with a human-sounding description |

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

## Requirements

- **Node ≥18** (npx forces it; the skills ship dependency-free `.mjs` helpers).
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
