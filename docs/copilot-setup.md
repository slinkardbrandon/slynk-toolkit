# Using these skills with GitHub Copilot CLI

The Copilot CLI consumes the same `SKILL.md` format as Claude Code and scans
several directories for skills, including `~/.copilot/skills`. The installer
writes there directly.

## Install

```bash
npx slynk-toolkit
```

If `~/.copilot` exists, this copies `slynk-spec`, `slynk-handoff`, and
`slynk-create-pr` into `~/.copilot/skills`, with helper paths templated to
absolute. Then in `copilot`:

```
/skills reload
/skills info slynk-spec
```

Re-run `npx slynk-toolkit` to update. `COPILOT_CONFIG_DIR` overrides the
`~/.copilot` location if you've moved it.

## Where Copilot looks for skills

- **Personal:** `~/.copilot/skills`, `~/.agents/skills`
- **Project:** `.github/skills`, `.claude/skills`, `.agents/skills`

## Name / directory contract

Copilot requires a skill's frontmatter `name` to match its directory name. The
installer handles this: it installs each skill as `slynk-<name>/` and rewrites
the frontmatter `name:` to `slynk-<name>` to match. No manual edits needed.

## Helper-script paths

`spec` and `handoff` ship Node helpers (`create-pr` doesn't). In the installed
`SKILL.md`, the `{{SLYNK_DIR}}` token has been expanded to the skill's absolute
install dir, so helpers run by absolute path:

```bash
node "/home/you/.copilot/skills/slynk-spec/spec-context.mjs"
```

No `PATH` entry and no env var required — just **Node ≥18** available.
