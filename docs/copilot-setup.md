# Using these skills with GitHub Copilot CLI

The Copilot CLI consumes the exact same `SKILL.md` format as Claude Code, and
it scans several directories for skills — including `.claude/skills`. There's
no marketplace; you just make the skill folder visible to Copilot.

## Where Copilot looks for skills

- **Personal:** `~/.copilot/skills`, `~/.agents/skills`
- **Project:** `.github/skills`, `.claude/skills`, `.agents/skills`

(`COPILOT_HOME` overrides the `~/.copilot` location if you've moved it.)

## Recommended: symlink (macOS / Linux / WSL)

Keeps `git pull` updates live without re-copying:

```bash
git clone https://github.com/slinkardbrandon/slynk-toolkit ~/dev/slynk-toolkit
mkdir -p ~/.copilot/skills
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/spec      ~/.copilot/skills/spec
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/handoff   ~/.copilot/skills/handoff
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/create-pr ~/.copilot/skills/create-pr
```

Then in `copilot`:

```
/skills reload
/skills info spec
```

To update later:

```bash
git -C ~/dev/slynk-toolkit pull
# then in copilot:  /skills reload
```

## Windows (no symlink): copy instead

```powershell
git clone https://github.com/slinkardbrandon/slynk-toolkit
mkdir $HOME\.copilot\skills\spec
copy slynk-toolkit\plugins\slynk\skills\spec\* $HOME\.copilot\skills\spec\
mkdir $HOME\.copilot\skills\handoff
copy slynk-toolkit\plugins\slynk\skills\handoff\* $HOME\.copilot\skills\handoff\
mkdir $HOME\.copilot\skills\create-pr
copy slynk-toolkit\plugins\slynk\skills\create-pr\* $HOME\.copilot\skills\create-pr\
```

Re-copy after each `git pull`.

## Helper-script paths

`spec` and `handoff` ship Node helpers (`create-pr` doesn't). In `SKILL.md` they
resolve two ways:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/spec/spec-context.mjs" 2>/dev/null || slynk-spec-context
```

`${CLAUDE_PLUGIN_ROOT}` is only set on a Claude Code marketplace install. On
Copilot it expands to empty, so the first command no-ops and the bare
`slynk-spec-context` shim runs from PATH — no manual substitution needed. The
shim self-locates its helper, so it works regardless of where the skill dir
lives. Just ensure the toolkit was installed via npm/npx (which puts the shims
on PATH) and **Node ≥18** is available.
