# Copilot instructions -- slynk-toolkit

## What this repo is

Reusable, cross-agent engineering **skills**: one `SKILL.md` per skill (prose an
agent follows) plus dependency-free `.mjs` helpers, installed across Claude Code,
GitHub Copilot (CLI + VS Code), OpenCode, and Codex via `npx slynk-toolkit`. The
product is mostly **prose and portability**, so reviews weight tone and
cross-agent correctness above typical app concerns.

Source of truth: `CONTEXT.md` (glossary -- challenge new terms against it) and
`CLAUDE.md` (working rules + the full review lenses). This file is the
review-time condensation.

## Tone (enforce on every doc / skill / spec change)

- Concise and human. No corporate fluff, no AI-isms, no preamble, no hedging.
- Bullets over paragraphs, tables over walls of text.
- No prose block over ~3 sentences; if longer, make it a list or table.
- Sound like a developer wrote it, not a model.

## DO flag

- **AI-isms**: "it's worth noting", "in this PR", "delve", "seamless",
  "robust"/"powerful" as filler, bullet-point restatements of the obvious.
  (Formatting like em-dashes is the linter's job, not the review's.)
- **Claude-only assumptions** in a `SKILL.md` or helper: assuming the runtime is
  Claude, a slash-command UX, a Task/subagent tool, or web tools, without a
  capability-gated fallback that degrades to text-only. Skills must work on
  Copilot / OpenCode / Codex too.
- **Cross-skill references that could grab the wrong skill**: a bare "the spec
  skill" or `/spec` where it should be the exact installed name `slynk-spec`.
  Intra-toolkit references use `slynk-<name>`.
- **Trigger overlap**: two skills whose frontmatter `description` could fire on
  the same prompt, or a missing bidirectional "not for X, use Y" pointer between
  a related pair (brainstorm|spec, spec|handoff, brainstorm|handoff).
- **Helper smells** in `.mjs`: a hardcoded install path (must resolve its own
  dir / use `{{SLYNK_DIR}}`), a runtime dependency (helpers are dependency-free),
  shelling out with an interpolated string instead of `execFileSync`, or piping
  content via `echo '...' | node` (apostrophes break it).
- **Frontmatter**: source `name` is the **bare** skill name matching its source
  dir (`skills/brainstorm/` -> `name: brainstorm`). The installer adds the
  `slynk-` prefix at build time, so don't flag a missing prefix in source. Do
  flag a `name` that doesn't match its dir, or a key that breaks loading on a
  non-Claude runtime. (This is distinct from cross-skill prose references, which
  use the installed `slynk-<name>` for runtime disambiguation.)
- **Restated boilerplate**: setup logic repeated in prose across `SKILL.md` files
  instead of in a shared helper/config (config over prose, scripts over tokens).
- **Doc drift**: a runtime-support claim not reflected in `docs/runtime-support.md`
  (the honest matrix), or a skill table / pipeline diagram out of sync with behavior.

## Do NOT flag

- `--` (double hyphen) -- the house em-dash substitute, intentional.
- `{{SLYNK_DIR}}` literals in `SKILL.md` -- installer-expanded sentinel, not a bug.
- A skill "not handling" a runtime's missing primitive -- if it degrades to
  text-only, that's by design.
- Missing unit tests for a prose-only skill change -- skills are prose; the
  vitest suite covers the installer.
- Helper comments aimed at humans -- `.mjs` files may carry explanatory comments.

## Conventions (reference)

- Helpers: Node `.mjs`, dependency-free, resolve their own paths, located via
  `{{SLYNK_DIR}}`. Scratch under `/tmp/slynk/<skill>/` with collision-safe `mktemp`.
- Install: `slynk-` prefix on both the dir and frontmatter `name`, every runtime.
- Full rules and the review lenses live in `CLAUDE.md`.
