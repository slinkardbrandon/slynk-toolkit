# slynk

An agent-skills toolkit. One plugin, three skills — invoked as `slynk:spec`,
`slynk:handoff`, and `slynk:create-pr` on Claude Code.

| Skill     | Invoke            | What it does                                                                                                                    |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| spec      | `slynk:spec`      | Stress-tests a plan, explores the codebase, and emits a paste-ready resume prompt before non-trivial work                       |
| handoff   | `slynk:handoff`   | Captures the session (code or planning) into a standalone doc and emits a paste-ready prompt that starts a fresh agent cold     |
| create-pr | `slynk:create-pr` | Self-reviews a branch, runs the repo's real CI checks, and opens a PR (GitHub) or MR (GitLab) with a human-sounding description |

## Requirements

- **Node** on `PATH` (the `spec` and `handoff` skills ship dependency-free `.mjs` helpers).
- For `spec`: a GitHub MCP server or the `gh` CLI to auto-fetch issues (optional).
- For `create-pr`: the `gh` CLI (GitHub) or `glab` CLI (GitLab), authenticated.

## Install

See the [repo README](../../README.md) for Claude Code and Copilot CLI
install instructions.
