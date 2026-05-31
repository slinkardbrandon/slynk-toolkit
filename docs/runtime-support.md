# Runtime Support

slynk works across AI coding agents from one `SKILL.md` per skill. Support is at
different maturity levels. This page is the honest status -- verified against each
runtime's actual source/docs, not aspiration.

| Runtime            | Status          | Skills load?        | Helper calls        | Install             |
| ------------------ | --------------- | ------------------- | ------------------- | ------------------- |
| Claude Code        | ✅ Verified     | Yes                 | Yes (absolute path) | `npx slynk-toolkit` |
| GitHub Copilot CLI | ⚠️ Partial      | Yes                 | Yes (absolute path) | `npx slynk-toolkit` |
| OpenCode           | ⚠️ Partial      | Yes                 | Yes (absolute path) | `npx slynk-toolkit` |
| Codex              | ⚠️ Experimental | Yes                 | Unverified          | `npx slynk-toolkit` |
| VS Code Copilot    | ⚠️ Unverified   | Likely (shared dir) | Unverified          | shares `~/.copilot` |

**Distribution:** `npx slynk-toolkit` is the single install path. The Claude
marketplace and the old `${CLAUDE_PLUGIN_ROOT}` / PATH-shim machinery are gone.
The installer copies each skill into the agent's skills dir and expands the
`{{SLYNK_DIR}}` token to that absolute dir, so helpers run by absolute path with
no PATH dependency -- the load-bearing PATH risk no longer exists.

## Research fan-out capability (`/brainstorm`)

`/brainstorm` can dispatch parallel research agents that return distilled,
cited findings. The mechanism is capability-gated on the runtime's subagent
primitive -- gate on the tool you actually observe, not the runtime brand. This
table is the static fallback when a probe isn't possible. Text-only brainstorm
works on every runtime regardless.

| Runtime            | Subagent primitive     | Fan-out mode          |
| ------------------ | ---------------------- | --------------------- |
| Claude Code        | Task tool + background | background-while-work |
| GitHub Copilot CLI | agent mechanism        | launch-and-await      |
| OpenCode           | none confirmed         | inline / await        |
| Codex              | none confirmed         | inline / await        |
| VS Code Copilot    | unverified             | inline / await        |

- **background-while-work:** agents run while the synchronous Q&A continues;
  findings fold in as they land.
- **launch-and-await:** dispatch, wait for results, then continue.
- **inline / await:** no parallel primitive -- the runner does the research
  itself or skips. Brainstorm stays fully functional text-only.

## Claude Code -- ✅ Verified

- Skills load from `~/.claude/skills/slynk-<name>`; invoke as `slynk-<name>`.
- Helper calls run by absolute path via the expanded `{{SLYNK_DIR}}` token.

## GitHub Copilot -- ⚠️ Partial

- Skills model is real; `SKILL.md` loads from `~/.copilot/skills`.
- The `slynk-` dir prefix plus the installer's frontmatter `name:` rewrite means
  `name` always equals the dir name, satisfying Copilot's validation contract.
- Invocation surface differs from Claude; the skill prose is portable as-is.

## OpenCode -- ⚠️ Partial

- Verified against `sst/opencode` source: scans `{skill,skills}/**/SKILL.md`
  under the config dir. The installer's `~/.config/opencode/skills` target is correct.
- Keys skills by frontmatter `name`, so the rewritten `slynk-<name>` is what the
  model selects on. Invoke-by-description, not slash commands.

## Codex -- ⚠️ Experimental

- Codex supports the SKILL.md model (developers.openai.com/codex/skills) and
  reads `~/.agents/skills` (and `.agents/skills` in the repo tree). `CODEX_HOME`
  (`~/.codex`) holds config only -- no skills subdir. The installer targets
  `~/.agents/skills`, so skills now load.
- Helper invocation under Codex's sandboxed exec model is **unverified** -- an
  absolute `node <path>` call may hit an approval prompt. Untested until a real
  Codex install confirms it.

## VS Code Copilot -- ⚠️ Unverified

- Per VS Code docs, agent-mode skills load from `~/.copilot/skills` (shared with
  the Copilot CLI), so the installer's existing Copilot write should land them --
  but VS Code Copilot is **not** a named runtime in the installer
  (`candidateRuntimes` in `lib/installer.mjs`), so it's neither detected nor
  reported, and the shared-dir path is unconfirmed here.
- Helper exec (`node <path>`) in agent mode is unverified; the skill degrades to
  text-only if it can't run.
- `argument-hint` is a documented VS Code frontmatter field, so it doesn't block
  loading there (unlike the open question for the Copilot CLI).
- To claim real support: confirm the skills dir, add a named installer entry,
  verify helper exec, then upgrade this row.

## How this was verified

Findings come from a per-runtime review that read each agent's real discovery
code/docs (OpenCode source, Codex + Copilot skills docs, Claude Code skill
behavior), not from assumptions. Re-verify before upgrading a status.
