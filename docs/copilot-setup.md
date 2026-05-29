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
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/spec    ~/.copilot/skills/spec
ln -s ~/dev/slynk-toolkit/plugins/slynk/skills/handoff ~/.copilot/skills/handoff
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
```

Re-copy after each `git pull`.

## Helper-script paths

Claude Code sets `${CLAUDE_PLUGIN_ROOT}` automatically. Copilot has no
equivalent variable, so when a skill runs a helper script, it resolves the
script from its own directory (the path shown by `/skills info <name>`). You
don't need to edit anything — just make sure **Node** is on your `PATH`.

## Known issue

There's an open Copilot CLI bug where relative script paths in `SKILL.md`
aren't always resolved against the skill's canonical directory when the
working directory changes
([copilot-cli#1090](https://github.com/github/copilot-cli/issues/1090)). These
skills work around it by resolving an absolute path to the script rather than
relying on a bare `./script.mjs`.
