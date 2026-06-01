<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# slynk-mjs-utils -- shared .spec.yml config helper

> Spec session -- 2026-06-01
> Branch: feat/spec-review-skill (alongside the spec-review work)
> Parent: docs/specs/2026-06-01-spec-review-skill.md (consolidates the helpers that spec touched)

## Summary

Consolidate `.spec.yml` handling into one shared module at `skills/slynk-mjs-utils/`, imported via
`../slynk-mjs-utils/` by the three helpers that each re-implement it. Fixes a silent override bug in
`spec-context.mjs` and establishes a clobber-safe shared-lib convention in the installer: a `skills/*`
dir with no `SKILL.md` is a shared lib (copied verbatim, not prefixed, not routed) rather than a skill.

## Key Decisions

- **Shared module `skills/slynk-mjs-utils/spec-config.mjs`** exports `readSpecConfig(repoRoot)`,
  `getRepoRoot()`, `gatherConventionFiles(repoRoot)` -- config plus the two functions both context
  helpers duplicate. The correct snake_case->camelCase normalization (originally in
  `spec-review-context.mjs`, now consolidated into this module) is the reference behavior; one canonical
  convention-file list/order ends the "mirrors spec-context" divergence flagged in
  `docs/specs/2026-06-01-spec-review-skill.md`'s review. `getRepoRoot()` takes no
  param (derives root from `git rev-parse`); `readSpecConfig`/`gatherConventionFiles` take `repoRoot` so
  they stay pure and directly unit-testable -- the asymmetry is intentional.
- **Read-only.** Nothing in the toolkit writes `.spec.yml` (the skills never create one), so a
  `writeSpecConfig` would be dead code. Add it only when a real consumer appears.
- **Fixes the `output_dir` override bug by construction.** `spec-context.mjs`'s old local reader spread
  snake_case yaml keys over camelCase defaults (`{ outputDir: "docs/specs", ...config }`), so `config.output_dir`
  never overrode `config.outputDir` -- the consumed `output_dir` override (the resume-path spec
  resolution) was silently dropped. Routing through the shared reader removes the buggy path.
- **`context_file` is out of scope.** The shared reader normalizes it correctly, but no consumer reads
  it (both `gatherConventionFiles` impls read a hardcoded file list that always includes `CONTEXT.md`).
  Wiring a consumer to honor `context_file` (e.g. gate the glossary read) is deferred; this change
  claims no glossary-disable effect.
- **`write-spec-artifact.mjs` collapses** onto `readSpecConfig(repoRoot).outputDir`; its own
  `output_dir` regex and `cleanYamlValue` are deleted (confirmed no other caller).
- **Shared-lib convention is structural, not name-hardcoded.** Installer rule: a `skills/*` dir with a
  `SKILL.md` is a skill (prefixed `slynk-`, token-rendered, included in the installed-skill labels); a
  dir without one is a shared lib: it bypasses the `PREFIX + name` join entirely and copies verbatim
  under its source name (so `slynk-mjs-utils` stays `slynk-mjs-utils` -- the implementer skips the
  prefix-join for libs), omitted from the labels. The router already excludes it independently --
  `buildAgentsBlock` gates on the `ROUTES` allowlist, so a lib with no route never appears regardless.
  The `SKILL.md` filter governs render/prefix/copy-vs-verbatim and the labels, not the router.
- **Source dir name == installed dir name.** The relative import `../slynk-mjs-utils/` must resolve the
  same in link mode (`{{SLYNK_DIR}}` -> clone `skills/spec/`) and copy mode (`<rt.skills>/slynk-spec/`).
  An ESM relative import resolves against the invoked helper's own module dir, not the process cwd, and
  every runtime invokes the helper by absolute path via the `{{SLYNK_DIR}}` token -- so the source name
  must already carry the `slynk-` prefix. That prefix also lets uninstall's `startsWith(PREFIX)` sweep
  clean it for free.
- **Link mode needs no lib copy.** The install loop writes only the rendered `SKILL.md` (helpers read
  live from the clone via the token), and a lib has none; the importing skill's `{{SLYNK_DIR}}` already
  points where `../slynk-mjs-utils/` resolves. Don't add a stray link-mode copy branch for libs.
- **Clobber guard.** A no-`SKILL.md` dir whose name does not start with `slynk-` is skipped with a
  warning -- prevents copy mode from dropping an unprefixed dir into a user's skills root (un-swept,
  potential clobber).
- **No `--repo` flag added to `spec-context.mjs`.** The shared functions take `repoRoot` as a param, so
  they are unit-tested by direct ESM import -- no subprocess, no interface bloat. The existing
  `spec-review-context.mjs` subprocess tests already exercise the same shared reader end-to-end.

## Terms Clarified

- **Shared lib**: a `skills/*` directory with no `SKILL.md`. The installer copies it verbatim (no
  `slynk-` prefix added, no token render, not listed as a skill). Skills import it via a relative
  `../<dir>/` path. Must be named `slynk-*` in source.
  _Avoid_: calling it a "skill" -- it has no `SKILL.md` and never loads as one.

## Test Cases

- `readSpecConfig` honors a `.spec.yml` `output_dir` override. **(the bug fix -- the parse-logic
  regression guard; this is the single source `spec-context.mjs` now calls.)**
- `readSpecConfig` normalizes `context_file` (incl. parsing `context_file: false` to `false`), returning
  the configured value. (No consumer gates on it yet -- see the `output_dir` Key Decision scope note; no
  end-to-end "glossary disabled" assertion, since nothing implements that.)
- `readSpecConfig` defaults to `docs/specs` + `CONTEXT.md` when no `.spec.yml` exists.
- `readSpecConfig` strips inline `# comments` and surrounding quotes from values.
- `gatherConventionFiles(repoRoot)` returns the canonical convention-file set/order (regression for the
  cross-helper divergence).
- `listSkills` excludes a dir lacking `SKILL.md`; includes dirs that have one.
- Copy mode against a fixture skills tree (containing one `slynk-*` shared lib + a normal skill): the lib
  lands verbatim at `<rt.skills>/slynk-mjs-utils/` -- positive assertion on that exact unprefixed dir
  name + its files -- produces no `slynk-slynk-*`, does not token-render its files, and is omitted from
  the installed-skill labels.
- The real-tree copy-install assertions (`installer.test.mjs:150-197`) still pass once `listSkills`
  excludes the lib -- confirm the existing prefixed-skill checks are unaffected.
- Clobber guard: a no-`SKILL.md` dir without a `slynk-` prefix is skipped and warned.
- Uninstall removes `slynk-mjs-utils` via the existing prefix sweep.
- `npm test` (existing 34 + new) green; lint + format:check clean.

## Implementation Plan

### Files to touch

- `skills/slynk-mjs-utils/spec-config.mjs` (new) -- shared reader + `getRepoRoot` + `gatherConventionFiles`.
- `skills/spec/spec-context.mjs` (edit) -- import shared; drop local `readSpecConfig`, inline repoRoot
  derivation, `gatherConventionFiles`. Bug fix lands here.
- `skills/spec-review/spec-review-context.mjs` (edit) -- import shared; drop local copies.
- `skills/spec/write-spec-artifact.mjs` (edit) -- use shared `readSpecConfig().outputDir`; delete own
  regex + `cleanYamlValue`.
- `lib/installer.mjs` (edit) -- `listSkills` filters to `SKILL.md`-bearing dirs; `install()` copies
  shared-lib dirs verbatim per runtime; clobber guard for non-`slynk-` unprefixed libs.
- `test/installer.test.mjs` (edit) -- shared-reader unit tests (direct import) + installer behavior tests.
- `AGENTS.md` "Helper scripts" (edit) -- document the shared-lib convention.
- `CONTEXT.md` (edit) -- add the shared-lib term.

### Approach

1. Create `skills/slynk-mjs-utils/spec-config.mjs` (dependency-free, own-path) with the one correct
   flat-YAML reader and the two shared helpers.
2. Repoint all three consumers at it via `import ... from "../slynk-mjs-utils/spec-config.mjs"`; delete
   their local copies. The override bug dies by construction.
3. Installer: split `skills/*` into skills (`SKILL.md` present) vs shared libs (absent); render+prefix
   the former, copy the latter verbatim; add the non-`slynk-` clobber guard.
4. Tests + docs; dev-install and confirm both skills still run and the override is honored.

### Patterns to follow

- `skills/slynk-mjs-utils/spec-config.mjs`'s `readSpecConfig` -- the correct reader (promoted from
  `spec-review-context.mjs`), now the single source.
- Installer test style: `mkdtemp` scratch repo, `execFileSync` subprocess for CLIs, direct ESM import
  for pure-function units.
- ESM relative import with explicit `.mjs` extension; dependency-free; own-path resolution
  (`{{SLYNK_DIR}}` token unchanged in the importing SKILL.md).
- After editing any SKILL.md, re-run `npm run install:local`. (No SKILL.md changes here, but the
  installer change means re-run to verify the new copy layout.)

### How to verify

- `npm test` green; `npm run lint && npm run format:check` clean.
- `npm run install:local`; confirm `slynk-mjs-utils/` lands as a sibling of `slynk-spec*` in the
  runtime skills dir and that `/spec` + `slynk-spec-review` still load and run.
- Drop a temp `.spec.yml` with a custom `output_dir`; confirm `/spec`'s resume reader now resolves
  specs there (the bug, fixed).

### Assumptions

- `cleanYamlValue` has no consumer besides the `output_dir` read (confirmed via grep).
- Codex sandbox resolves the `../slynk-mjs-utils` relative import at helper-exec time -- the same
  already-experimental exec assumption that applies to every helper, not new to this change.
