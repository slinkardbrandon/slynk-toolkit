# Handoffs

Paste-ready prompts for the next round of dedicated spec sessions, from the
2026-05-29 planning session. Each becomes a GitHub issue that `/spec <issue-number>`
can consume directly.

## Why these exist here (not in tmp)

`/handoff` writes to a machine-local tmp dir, which doesn't survive `git pull` or
cross to another machine. These needed to travel, so they live in-repo as a work
queue and get filed as issues. (That gap is noted in the roadmap as a candidate
`/handoff --issue` mode.)

## To file them (personal machine — work box can't reach the personal repo)

```bash
gh auth status                                       # slinkardbrandon active
git push -u origin chore/tooling-and-distribution    # docs must be on the remote first
bash docs/handoffs/file-issues.sh
```

One-shot — re-running creates duplicates. Then `/spec <issue-number>` per session.

## Order

1. **npx installer** — foundational, do first (constrains every skill's shape)
2. **bootstrap dial** + **todo convention** — independent, parallelizable
3. **/tdd lens** — depends on 1-2
4. **spec-review** — input is in-repo, can go anytime
5. **pr-review** / **pr-triage** — NOT filed; gather your existing skill flavors first (roadmap Tier 2)
