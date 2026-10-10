# Setting up `slynk-drift`

Flags docs that no longer match the code. Report-only: one comment per run on a rolling
tracking issue, never edits docs or opens PRs. Design record:
[`specs/2026-10-10-slynk-drift-doc-drift-skill.md`](specs/2026-10-10-slynk-drift-doc-drift-skill.md).

Roll it out in phases. Don't schedule it until manual runs come back with signal, not noise.

| Phase | Where                        | Gate to the next phase                        |
| ----- | ---------------------------- | --------------------------------------------- |
| 1     | Local session, by hand       | A few runs with real findings, few false hits |
| 2     | Scheduled routine, "run now" | One clean end-to-end run posts to the issue   |
| 3     | Scheduled routine, nightly   | --                                            |

## Requirements

- `git` (hard requirement; the helpers exit 2 without it).
- `gh`, authenticated, for the watermark and tracking issue. Without it the run degrades to a
  printed report over the `--since` window, no dedupe, no notify.

## Phase 1: local

1. **Manifest.** Run `slynk-drift init` in the target repo. It proposes a `drift:` section from
   your docs' links and code spans, writes `.slynk.yml` on approval, and doesn't commit. Review
   the `sources` pathspecs, then commit. Key reference: [slynk-config.md](slynk-config.md).
2. **Label.** `gh label create "agent: drift"` (or your `drift.label`). The tracking issue,
   "Doc drift tracking", is created on the first report.
3. **Notify (optional).** Set `drift.notify` to an https URL. Public ntfy.sh topics are
   unauthenticated; the body is counts only, so treat it as look-when-convenient signal.
4. **Run.** `slynk-drift`, or `slynk-drift --since "14 days ago"` to widen the first window.
   A rerun with no new commits exits silently at the watermark.

False positive on a code span? Add the exact token to that entry's `ignore:` list.

## Phases 2-3: scheduled routine

Tested substrate: a claude.ai routine. Any scheduler that runs an agent with both repos checked
out works the same way.

**Git sources:** the consumer repo plus `slinkardbrandon/slynk-toolkit`. The routine reads the
skill straight from the toolkit checkout, so nothing gets installed.

**`GH_TOKEN`:** a fine-grained PAT with Issues read/write on the consumer repo only. The
routine's GitHub integration clones the sources; if yours doesn't, add Contents: read and
nothing else.

**Prompt.** The raw `SKILL.md` carries an unexpanded `{{SLYNK_DIR}}` token (the installer
normally fills it), so the prompt must map it:

```text
Run the slynk-drift skill against <consumer-repo> (headless).
Instructions: <toolkit checkout>/skills/drift/SKILL.md.
Wherever it says {{SLYNK_DIR}}, use <toolkit checkout>/skills/drift.
Run every command from the <consumer-repo> checkout. Ignore the {{SLYNK_VOICE}} line.
```

Headless runs never enter init mode: commit the manifest in phase 1 first.

**Rollout:**

- Phase 2: use the routine's manual "run now" as the controlled test. Confirm it bills to
  your subscription, not the API, before going further.
- Phase 3: enable the nightly cron. Nights with no new commits exit after the self-test and watermark check.

## Worked example

SureDocs runs this setup: manifest in its `.slynk.yml`, rollout recorded in its
`docs/AUTOMATION.md` ("Doc drift" section).
