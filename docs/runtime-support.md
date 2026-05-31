# Runtime Support

slynk works across AI coding agents from one `SKILL.md` per skill. Support is at
different maturity levels. This page is the honest status -- verified against each
runtime's actual source/docs, not aspiration.

| Runtime        | Status          | Skills load? | Helper calls        | Install             |
| -------------- | --------------- | ------------ | ------------------- | ------------------- |
| Claude Code    | ✅ Verified     | Yes          | Yes (absolute path) | `npx slynk-toolkit` |
| GitHub Copilot | ⚠️ Partial      | Yes          | Yes (absolute path) | `npx slynk-toolkit` |
| OpenCode       | ⚠️ Partial      | Yes          | Yes (absolute path) | `npx slynk-toolkit` |
| Codex          | ⚠️ Experimental | Yes          | Unverified          | `npx slynk-toolkit` |

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

| Runtime        | Subagent primitive     | Fan-out mode          |
| -------------- | ---------------------- | --------------------- |
| Claude Code    | Task tool + background | background-while-work |
| GitHub Copilot | agent mechanism        | launch-and-await      |
| OpenCode       | none confirmed         | inline / await        |
| Codex          | none confirmed         | inline / await        |

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

## How this was verified

Findings come from a per-runtime review that read each agent's real discovery
code/docs (OpenCode source, Codex + Copilot skills docs, Claude Code skill
behavior), not from assumptions. Re-verify before upgrading a status.
