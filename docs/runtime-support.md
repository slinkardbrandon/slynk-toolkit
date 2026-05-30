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
