# slynk-toolkit — working instructions

Read `CONTEXT.md` for the project glossary. Challenge new terms against it.

## Tone — all output, especially specs and docs

- Concise and human. No corporate fluff, no AI-isms, no em-dashes.
- Specs cleanly defined but **not wordy**. Cut every sentence that doesn't carry signal.
- Bullets over paragraphs. Tables over walls of text.
- State facts and decisions plainly — no hedging, no "it's worth noting," no preamble.
- Sound like a developer wrote it, not a model.

## Specs

- The spec doc is the durable record; the resume prompt is ephemeral — keep them separate.
- Every decision gets a one-line rationale, not a paragraph.
- Don't restate what a linked artifact already says — reference it by path.
- Open questions are a list, not an essay.

## This project's principles

- **Lightweight by default, dialable up.** Mechanisms, not forced ceremony (see `CONTEXT.md`).
- **Cross-agent first.** One `SKILL.md` works across Claude Code, Copilot, Codex, OpenCode.
- **Derive, don't invent.** Skills read real config/code as source of truth. Specs transcribe
  existing patterns rather than inventing — never fabricate a flavor you can look up.
- **Each skill owns one thing.** No skill bleeds into another's artifact.
- **Config over prose, scripts over tokens.** Repeatable setup belongs in dependency-free
  helpers and a shared config file that skills load, not in restated `SKILL.md` steps. A skill
  reads config and state; it doesn't re-derive them each run. Spend the least tokens possible on
  boilerplate setup so the model's budget goes to the actual work.

## Helper scripts

- Node `.mjs`, dependency-free, resolve their own paths. Never hardcode an install path.
- Don't pipe content through `echo '...' | node` — apostrophes break it. Use a scratch file or stdin.
- Skills locate their own helpers via the `{{SLYNK_DIR}}` sentinel token (see `CONTEXT.md`),
  expanded by the installer to the skill's absolute install dir. No PATH lookup, no `${CLAUDE_PLUGIN_ROOT}`.

## After editing any skill

Dev installs run in `--link` mode (`npm run install:local` -> `node bin/slynk-toolkit.mjs
--link`). Each installed `SKILL.md` is templated to point its `{{SLYNK_DIR}}` token back at this
clone, so:

- **Helper (`.mjs`) edits are live** — the installed SKILL.md already targets the clone's copy.
- **SKILL.md edits need a re-run** — `npm run install:local` rewrites the templated copy. Re-run
  after editing any `SKILL.md`, or after adding/renaming a skill, then reload skills in the agent.

`npm run uninstall:local` removes the `slynk-*` entries. Consumers install with copy mode via
`npx slynk-toolkit` (no clone, helpers copied alongside each SKILL.md).
