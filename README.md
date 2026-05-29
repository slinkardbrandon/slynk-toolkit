# slynk-toolkit

Reusable agent skills that empower an engineering workflow. Each skill is a
single folder driven by one `SKILL.md` — the same file works on **Claude Code**
and the **GitHub Copilot CLI**.

## Skills

One plugin (`slynk`), three skills. On Claude Code they invoke as `slynk:spec`,
`slynk:handoff`, and `slynk:create-pr`; on Copilot CLI as `spec`, `handoff`,
and `create-pr`.

| Skill                                         | What it does                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`spec`](plugins/slynk/skills/spec)           | Stress-tests a plan, explores the codebase, and emits a paste-ready resume prompt before non-trivial work                                                 |
| [`handoff`](plugins/slynk/skills/handoff)     | Captures the session (code or planning) into a standalone doc and emits a paste-ready prompt that starts a fresh agent cold                               |
| [`create-pr`](plugins/slynk/skills/create-pr) | Self-reviews a branch, runs the repo's real CI checks (derived from its config), and opens a PR (GitHub) or MR (GitLab) with a human-sounding description |

## Install — Claude Code

```bash
claude plugin marketplace add slinkardbrandon/slynk-toolkit
claude plugin install slynk@slynk-toolkit
# then, in a session:  slynk:spec   slynk:handoff   slynk:create-pr
```

Updates are pinned to a git commit. Re-run `claude plugin update slynk`
after a new release.

## Install — GitHub Copilot CLI

Copilot has no marketplace; point it at the skill folder directly.

```bash
git clone https://github.com/slinkardbrandon/slynk-toolkit ~/dev/slynk-toolkit
mkdir -p ~/.copilot/skills
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/spec      ~/.copilot/skills/spec
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/handoff   ~/.copilot/skills/handoff
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/create-pr ~/.copilot/skills/create-pr
# in copilot:  /skills reload   then   /skills info spec
# update later:  git -C ~/dev/slynk-toolkit pull   then   /skills reload
```

On Windows (no symlink), copy the folder instead — see
[docs/copilot-setup.md](docs/copilot-setup.md).

## Helper scripts & path resolution

`spec` and `handoff` ship small Node helpers, invoked via a dual-path command:
`${CLAUDE_PLUGIN_ROOT}` (set on a Claude marketplace install) if present, else
the bare `slynk-*` shim on PATH (installed by npm/npx). No paths to edit either
way. See [docs/copilot-setup.md](docs/copilot-setup.md) for details.

Scripts are dependency-free `.mjs`, so all you need is **Node ≥18** on your
`PATH`.

## License

[MIT](LICENSE)
