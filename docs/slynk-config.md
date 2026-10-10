# `.slynk.yml` config

One file at the repo root, one section per skill. Every section is optional; a skill
reads only its own. Commit it with the repo.

```yaml
# slynk-toolkit config. Each skill reads its own section.
spec:
  output_dir: docs/specs
  context_file: CONTEXT.md
drift:
  notify: https://ntfy.sh/<your-topic>
  docs:
    - path: CLAUDE.md
      sources: ["package.json", "scripts/", ".github/workflows/"]
      claims: [paths, scripts]
    - path: docs/DECISIONS.md
      sources: ["packages/", "services/"]
      recency_only: true
```

## `spec:` (`slynk-spec`, `slynk-spec-review`)

| Key            | Default      | Meaning                                         |
| -------------- | ------------ | ----------------------------------------------- |
| `output_dir`   | `docs/specs` | Where spec artifacts land                       |
| `context_file` | `CONTEXT.md` | Glossary file; `false` disables glossary upkeep |

A legacy flat `.spec.yml` (same keys, no `spec:` wrapper) still works when `.slynk.yml` has no
`spec:` section.

## `drift:` (`slynk-drift`)

| Key      | Default        | Meaning                                                                     |
| -------- | -------------- | --------------------------------------------------------------------------- |
| `label`  | `agent: drift` | Label that finds the rolling tracking issue                                 |
| `notify` | none           | https URL; one plain-text POST per run, counts only. Unset: no network call |
| `docs`   | required       | List of doc entries (below)                                                 |

Each `docs` entry:

| Key            | Required | Meaning                                                                   |
| -------------- | -------- | ------------------------------------------------------------------------- |
| `path`         | yes      | Repo-relative doc path. Never a spec in `spec.output_dir` (point-in-time) |
| `sources`      | yes      | Git pathspecs the doc describes; drive recency and the semantic window    |
| `claims`       | no       | Narrow fact checks to `paths`, `scripts`, `links`. Omit for all three     |
| `recency_only` | no       | `true` skips fact checks; for decision logs and history docs              |
| `ignore`       | no       | Exact code-span tokens to suppress (residual false positives)             |

Config errors (exit 2): `claims` and `recency_only` together, absolute or `..` pathspecs,
non-https `notify`, unknown claim class.

## Parser limits

Dependency-free, so a YAML subset: top-level sections, scalar keys, inline lists (`[a, b]`),
and block lists of flat maps. No nesting deeper than that, no anchors, no multi-line strings.
