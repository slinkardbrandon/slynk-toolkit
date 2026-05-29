Spec out slynk-toolkit's npx installer. **Foundational — do this first; it constrains every other skill's shape.**

Read first (durable context):

- docs/specs/2026-05-29-slynk-roadmap-mechanisms.md
- docs/runtime-support.md
- scripts/install-local.mjs (the working local installer)

Use the /spec skill.

Goal: a published `npx slynk-toolkit` installer that installs skills + bin shims across Claude / Copilot / Codex / OpenCode. The local installer already works and is the proven shape — generalize it into a published package (CI publishes on tag).

Locked decisions (don't relitigate, see roadmap Key Decisions):

- npx is the SINGLE install path. The Claude marketplace is DROPPED — npx forces node (which the .mjs helpers/shims require) and removing the plugin model eliminates `${CLAUDE_PLUGIN_ROOT}` and the two-model straddle. No shipped breakage here; this is net-new publishing + marketplace teardown.
- copy-default for consumers, symlink for dev (--link); flag-driven with interactive prompt fallback; bin entry only, NO postinstall hook.

Must cover (roadmap Tier 1.5):

1. Marketplace teardown: remove .claude-plugin/marketplace.json + plugins/slynk/.claude-plugin/plugin.json; simplify the interim dual-path helper calls back to plain bare commands; consider flattening plugins/slynk/skills/ -> skills/; rewrite README to npx-only.
2. Codex path bug: local installer targets ~/.codex/skills, but Codex reads ~/.agents/skills. Verify against Codex docs, then fix.
3. Prefix/name story: marketplace gone => CC slynk: namespace moot. Remaining tension: Copilot requires frontmatter name == dirname (slynk- prefix breaks validation) vs OpenCode keys by frontmatter name (prefix cosmetic). Pick one coherent story.
4. PATH reliability (load-bearing): with no env-var fallback, bare shims MUST reliably land on PATH. npm global bin-link covers global install; solve the local case (~/.local/bin often not on PATH; agent exec shell may not inherit interactive PATH).
5. Per-runtime content adaptation: are skills portable as-is, or do any need per-runtime rewriting (GSD does this)? Verify per runtime.

Don't invent runtime paths — verify against real docs/source (findings in runtime-support.md). Produce the spec artifact, then the resume prompt.
