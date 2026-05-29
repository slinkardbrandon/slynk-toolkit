# Runtime Support

slynk aims to work across AI coding agents from one `SKILL.md` per skill. Support
is at different maturity levels. This page is the honest status — verified against
each runtime's actual source/docs, not aspiration.

| Runtime        | Status      | Skills load? | Helper calls | Install documented? |
| -------------- | ----------- | ------------ | ------------ | ------------------- |
| Claude Code    | ✅ Verified | Yes          | Yes (dual)   | Yes (marketplace)   |
| GitHub Copilot | ⚠️ Partial  | Yes\*        | Yes (shim)   | Yes (manual + npm)  |
| OpenCode       | ⚠️ Partial  | Yes          | Yes (shim)   | No                  |
| Codex          | ❌ Broken   | No\*\*       | n/a          | No                  |

Helper calls use dual-path resolution: `${CLAUDE_PLUGIN_ROOT}` absolute path when
set (marketplace), else the `slynk-*` PATH shim (npm/local installer). The shim
requires the installer's bin dir on PATH — the installer warns if it isn't.

## Claude Code — ✅ Verified

- Skills load via the marketplace plugin (`slynk:spec`) or the local installer
  (`slynk-spec` in `~/.claude/skills`).
- Helper calls resolve both ways (env var on marketplace, shim on npm/local).
- Naming differs by install path: marketplace = `slynk:` namespace, local = `slynk-` prefix.

## GitHub Copilot — ⚠️ Partial

- Skills model is real; SKILL.md loads.
- \*The local installer's `slynk-` directory prefix conflicts with the Agent Skills
  rule that frontmatter `name` must match the parent directory name (`name: spec`
  in a `slynk-spec/` dir). May fail strict validation / surface under a wrong name.
- Two install stories exist (README manual symlink vs npm installer) and produce
  different results. Needs reconciliation.
- `argument-hint` frontmatter (used by handoff) is a Claude extension Copilot ignores.

## OpenCode — ⚠️ Partial

- Verified against `sst/opencode` source: scans `{skill,skills}/**/SKILL.md` under
  the config dir. The installer's `~/.config/opencode/skills` target is **correct**.
- Keys skills by frontmatter `name`, not directory name — so the `slynk-` prefix is
  cosmetic here and provides no collision protection.
- Invoke-by-description, not slash commands — `/spec` style invocation doesn't apply;
  the model selects skills from their `description`.
- No end-user install section in the README yet.

## Codex — ❌ Broken (one path fix away from real)

- Codex **does** support the SKILL.md model now (verified: developers.openai.com/codex/skills).
- \*\*But the installer targets `~/.codex/skills`, which Codex ignores. Codex reads
  `~/.agents/skills` (and `.agents/skills` in the repo tree). `CODEX_HOME` (`~/.codex`)
  holds config only — no skills subdir. So the installer prints "codex linked" and
  Codex sees nothing.
- Fix: point the codex runtime at `~/.agents/skills`. Tracked in the distribution work.
- Helper invocation on Codex's sandboxed exec model is unverified — bare PATH commands
  may hit approval prompts; shipping helpers in a skill `scripts/` dir may fit better.

## How this was verified

Findings come from a per-runtime review pass that read each agent's real discovery
code/docs (OpenCode source, Codex + Copilot skills docs, Claude Code plugin behavior),
not from assumptions. Re-verify before upgrading a status.
