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

`spec` and `handoff` ship a Node helper (`create-pr` doesn't). In `SKILL.md`
those are invoked as `node "${CLAUDE_PLUGIN_ROOT}/skills/<name>/<script>.mjs"`.

Claude Code sets `${CLAUDE_PLUGIN_ROOT}` automatically. **Copilot has no such
variable** — it expands to empty, so the literal path is wrong. On Copilot,
substitute the skill's real directory (the path shown by
`/skills info <name>`) for `${CLAUDE_PLUGIN_ROOT}/skills/<name>`. For example:

```bash
# Claude Code (automatic):
node "${CLAUDE_PLUGIN_ROOT}/skills/spec/spec-context.mjs"

# Copilot CLI (substitute the dir from `/skills info spec`):
node ~/.copilot/skills/spec/spec-context.mjs
```

The agent does this substitution at run time — you don't edit any files. Just
make sure **Node ≥18** is on your `PATH`.

> Related: an open Copilot CLI issue where relative script paths in `SKILL.md`
> aren't always resolved against the skill's canonical directory when the
> working directory changes
> ([copilot-cli#1090](https://github.com/github/copilot-cli/issues/1090)) —
> another reason to pass an absolute path, not a bare `./script.mjs`.
