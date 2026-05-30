---
name: create-pr
description: >-
  Self-review a local branch, auto-fix what's safe, verify the repo's real
  CI checks pass, then open a pull/merge request with a human-sounding
  description. Detects GitHub (gh) or GitLab (glab) automatically and derives
  the checks to run from the repo's CI config, nothing hardcoded. Use when the
  user wants to open or create a PR/MR, or ship a branch, e.g. "open a PR for
  this", "self-review and ship this branch", "review my changes as a pre-PR
  step". Not for reviewing a diff without opening a PR; use a code-review skill
  for that.
argument-hint: base branch (optional)
---

# Create Pull / Merge Request

## Overview

A full pre-PR workflow for your own branches. Self-reviews the local diff for
logic and correctness, auto-fixes what it safely can, verifies that the repo's
**actual** CI checks pass (derived from its CI config, not assumed), then drafts
and opens a pull request (GitHub) or merge request (GitLab).

**Platform-agnostic:** detects the git host and uses the matching CLI —
`gh` for GitHub (default), `glab` for GitLab (fallback). Throughout this doc,
"PR" means pull request on GitHub and merge request on GitLab.

**Only works inside a git repository** — exits early if run outside one.

## Platform abstraction

Detect the platform once (Step 0) and use the matching column everywhere:

| Operation    | GitHub (`gh`)                                                                                              | GitLab (`glab`)                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Auth check   | `gh auth status`                                                                                           | `glab auth status`                                      |
| Current user | `gh api user --jq .login`                                                                                  | `glab api user --jq .username`                          |
| CI config    | `.github/workflows/*.{yml,yaml}`                                                                           | `.gitlab-ci.yml` (+ `include:`d files)                  |
| PR template  | `.github/pull_request_template.md` / `.github/PULL_REQUEST_TEMPLATE.md` / `.github/PULL_REQUEST_TEMPLATE/` | `.gitlab/merge_request_templates/*.md`                  |
| Create       | `gh pr create`                                                                                             | `glab mr create`                                        |
| Reviewers    | auto via CODEOWNERS                                                                                        | auto via `CODEOWNERS` (Premium) — don't assign manually |

Default branch detection is platform-neutral and local-first (no network, no
locale dependence). Fall back to the CLI only if `origin/HEAD` isn't set:

```bash
# Capture first, then branch — a piped `|| fallback` is dead code here because
# the pipe's exit status is sed's (always 0), so it never fires on empty input.
base=$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -n "$base" ] || base=$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')
```

(If `origin/HEAD` is missing, `git remote set-head origin -a` repopulates it.)

## Inputs

Optionally provide a base branch after invoking this skill:

- _(no argument)_ — infers the base branch automatically
- `main` — explicitly sets the base branch

## Workflow

> **Parallelism strategy:** Steps 2, 3, and 4 have no dependency on each other
> and can all run concurrently once Step 1 has the diff. Within Step 6, the
> formatter must run first (it writes files), but every other check runs in
> parallel. The self-review (Step 5) is the only step that requires sequential
> user interaction before the pipeline can start.

### Step 0 — Guard Checks & Platform Detection

Run all of the following before doing anything else:

```bash
# 1. Confirm we're inside a git repo
git rev-parse --is-inside-work-tree

# 2. Identify the git host
git remote get-url origin

# 3. Current branch
git branch --show-current

# 4. Default branch (local-first; CLI fallback only if origin/HEAD is unset).
# Capture-then-branch: a piped `|| fallback` never fires (pipe exit = sed = 0).
base=$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -n "$base" ] || base=$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')
```

**Detect the platform** from the remote URL host:

- Host contains `github.com` (or a known GitHub Enterprise host) → **GitHub**, use `gh`.
- Host contains `gitlab` (gitlab.com or a self-hosted `gitlab.*`) → **GitLab**, use `glab`.
- **Ambiguous host** (self-hosted, custom domain): decide by signal, in order —
  1. `.gitlab-ci.yml` present → GitLab; `.github/workflows/` present → GitHub.
  2. Only one of `gh` / `glab` is installed → use it.
  3. Still unclear → ask the user which platform this remote is.

Set the matching CLI for all later steps. Then verify auth:

```bash
gh auth status     # GitHub
# or
glab auth status   # GitLab
```

**Exit conditions (checked in this order):**

- Not in a git repo → stop: "This skill only works inside a git repository."
- Matching CLI not authenticated → stop:
  - GitHub: "The `gh` CLI is not authenticated. Run `gh auth login` first."
  - GitLab: "The `glab` CLI is not authenticated. Run `glab auth login` first."
- Matching CLI not installed → stop and tell the user to install it (`gh` from cli.github.com, `glab` from gitlab.com/gitlab-org/cli).
- Currently on the default branch → ask the user:

  > "You're on `<branch>`. PRs are opened from feature branches, not the default branch. Would you like to create a new branch now?"

  Choices:
  - **Create a new branch** — ask for a branch name (suggest one based on any staged/uncommitted changes if present, following the `type/description` convention — e.g. `feat/add-widget` — or `type/TICKET-description` if the repo uses ticket keys), run `git checkout -b <name>`, then continue
  - **Cancel** — stop

> **Do not** check for commits ahead of base yet — that happens at the end of Step 0b.

Capture the authenticated user login for later use (`gh api user --jq .login` or `glab api user --jq .username`).

### Step 0b — Handle Uncommitted Changes

Before gathering the diff, check the working tree state:

```bash
git status --short
```

Classify what's present:

- **Staged changes** (`A`, `M`, `D` in the index column)
- **Unstaged changes** (`M`, `D` in the worktree column)
- **Untracked files** (`??`)

If there are **no staged or unstaged changes**, proceed normally — the PR will cover only committed work.

If there **are** staged or unstaged changes, show a summary grouped by status and ask:

> "You have uncommitted changes. What would you like to do with them?"

```
Staged:
  M  src/foo.ts
  A  src/bar.ts

Unstaged:
  M  src/baz.ts

Untracked:
  ??  src/new-file.ts
```

Choices:

- **Commit all** — `git add -A` and commit with an auto-generated message derived from the branch name/ticket, e.g. `feat: add widget` — user can edit before confirming
- **Choose what to include** — interactively ask per file/group: include or exclude. Stage the included files and commit. Excluded files stay in the working tree (unstaged), untouched.
- **Stash and ignore** — `git stash` to set aside all changes, continue with only committed work. Remind the user to `git stash pop` afterwards.
- **Cancel** — stop

If the user chooses **Commit all** or **Choose what to include**, confirm the commit message before committing:

> "Commit message: `<proposed message>` — use this, or type a different one?"

After committing, re-check for commits ahead of base:

```bash
git log origin/<base>...HEAD --oneline
```

If still nothing → stop: "No commits found ahead of `<base>`. Nothing to review."

---

### Step 1 — Gather Context

Fetch everything needed in parallel:

```bash
# Full diff vs base
git diff origin/<base>...HEAD

# Commit list
git log origin/<base>...HEAD --oneline

# Repo root (for finding config files)
git rev-parse --show-toplevel

# Diff stat (line count for Step 5)
git diff origin/<base>...HEAD --stat
```

**Read the PR template** for the detected platform:

```bash
# GitHub
cat .github/pull_request_template.md 2>/dev/null \
  || cat .github/PULL_REQUEST_TEMPLATE.md 2>/dev/null \
  || ls .github/PULL_REQUEST_TEMPLATE/ 2>/dev/null

# GitLab
ls .gitlab/merge_request_templates/ 2>/dev/null && cat .gitlab/merge_request_templates/*.md 2>/dev/null
```

**Read the CI config** for the detected platform — this is the source of truth for Step 6:

```bash
# GitHub
ls .github/workflows/ 2>/dev/null

# GitLab
cat .gitlab-ci.yml 2>/dev/null
```

Parse the remote URL to extract `owner`/`repo` (GitHub) or the project path (GitLab) for later CLI commands.

> **Once Step 1 is complete, Steps 2, 3, and 4 can all run in parallel.** Launch them concurrently and collect all results before Step 5.

---

### Step 2 — Generate PR Title

Parse the current branch name into a PR title:

```
<type>: <short description>
```

…or, if the repo uses ticket keys in branch names:

```
<type>: <TICKET> - <short description>
```

**Parsing rules:**

- Branch format: `<type>/<TICKET>-<description-words>` or `<type>/<description-words>`
- `type` = segment before the first `/` (`feat`, `fix`, `chore`, …)
- `TICKET` = uppercase ticket key matching `[A-Z]+-\d+` (e.g. `ABC-123`), if present
- `description` = remaining words after stripping the ticket, hyphens → spaces

**Examples:**

| Branch                      | Generated Title              |
| --------------------------- | ---------------------------- |
| `feat/add-widget`           | `feat: add widget`           |
| `fix/null-deref-in-cart`    | `fix: null deref in cart`    |
| `feat/ABC-123-new-flow`     | `feat: ABC-123 - new flow`   |
| `chore/update-dependencies` | `chore: update dependencies` |

If the branch name doesn't match (e.g. no `/`), ask:

> "I couldn't parse a PR title from this branch name (`<branch>`). What should the title be?"

---

### Step 3 — Commit Hygiene Check

Inspect `git log origin/<base>...HEAD --oneline`.

**Skip commits created by this skill** (`chore: address self-review findings`, `chore: apply formatter`, `chore: add change file`, the auto-generated Step 0b commit).

Flag remaining commits that look like work-in-progress or noise:

- `wip`, `fixup!`, `squash!`, `temp`, `tmp`, `test commit`, `asdf`, single-word messages, messages that are just a file name
- Very long lists (10+) where most messages are trivial

If flagged, offer:

> "Some commits look like work-in-progress. Want me to interactively rebase to clean them up before opening the PR?"

Choices:

- **Clean them up** — most agent runtimes can't drive an interactive
  `git rebase -i` (there's no editor session). Prefer a non-interactive
  squash: `git reset --soft origin/<base> && git commit` with a single clean
  message (confirm the message first). Only fall back to `git rebase -i
origin/<base>` if the user is running it themselves in a real terminal.
- **Leave them as-is** — continue

---

### Step 4 — Secrets Scan

Scan the diff for committed secrets before any review or push.

**Try in order:**

1. **`gitleaks`** (if installed):

   ```bash
   git diff origin/<base>...HEAD | gitleaks detect --pipe --no-banner
   ```

2. **Pattern grep fallback** (POSIX ERE — `\s` is PCRE and matches a literal
   `s` on BSD/macOS grep, silently missing real secrets, so use
   `[[:space:]]`):

   ```bash
   git diff origin/<base>...HEAD | grep -iE 'password[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{6,}|secret[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{6,}|api[_-]?key[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{10,}|token[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"']{10,}|BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}'
   ```

   Note if falling back: "Full secrets scanning requires `gitleaks`. Using basic pattern matching — install gitleaks for more comprehensive coverage."

**If any matches are found — hard stop.** Show the matched lines and locations:

> "Potential secrets detected in the diff. Resolve these before opening a PR. You may need to rotate any exposed credentials."

Do not proceed until the user confirms false positives or resolves them.

---

### Step 5 — Self-Review

**If the diff exceeds 500 changed lines** (from Step 1's stat), note it first:

> "This is a large diff (+X lines). Consider whether it could be split into smaller PRs."

Review the diff for **logic and correctness only** — this is your own code, so the review is constructive, not adversarial. Catch anything you'd be embarrassed to have a teammate point out later.

> **Scope:** Logic and correctness, not style.
>
> - ❌ **Do NOT flag** whitespace, indentation, quote style, semicolons, import ordering, or anything a linter/formatter would catch automatically.
> - ✅ **Do flag** logic, correctness, security, type safety, and architectural concerns.

Identify findings across three severities:

**🔴 Critical (must fix before merging)**

- Bugs / logic errors — wrong conditions, off-by-one, null/undefined dereferences, wrong branching
- Security — injection, broken auth/authz (IDOR, privilege escalation), hardcoded secrets or PII in logs/responses, non-constant-time secret comparisons, unsafe deserialization, missing rate limiting/input-size limits on public endpoints
- Breaking changes — removed exports, changed public signatures, incompatible type changes
- Data integrity — missing/insufficient input validation, incorrect data transformations
- Unsafe TypeScript (TS repos) — `any`, unchecked `as` assertions, missing return types on exported functions, `@ts-ignore`/`@ts-expect-error` without justification

**🟡 Important (should address)**

- Missing tests — new logic paths, edge cases, error branches without coverage
- Error-handling gaps — unhandled rejections, missing catch blocks, swallowed errors
- Logic inconsistency — behavior contradicting the PR intent or related code
- DRY violations — duplicated logic that already exists (or belongs in) a shared utility; name where the canonical version lives
- Performance — N+1 queries, unbounded loops, sync blocking in async contexts, leaks
- Weak TypeScript — overly broad unions, missing `readonly`, incorrect/missing generics

**🔵 Suggestions (nice to have)**

- Readability, minor DRY, naming inconsistent with patterns used elsewhere

Compile findings grouped by severity. Reference exact file paths and line numbers. Write each finding the way a thoughtful teammate would — short, direct, often phrased as a question ("Should this fail closed if `address` is missing?"). No severity labels in the finding body, no AI-sounding preambles.

After displaying the review, ask:

> "Found [N critical / M important / K suggestions]. Fix these automatically, or skip straight to running the checks?"

Choices:

- **Fix automatically** — apply fixes, then continue (below)
- **Skip fixes** — continue to checks without modifying code
- **Cancel** — stop

**If fixing automatically:** work most-to-least severe (Critical → Important → Suggestions). For each fix, apply the change; skip anything needing a broader architectural decision and note it. After all fixes:

```bash
git add -A
git commit -m "chore: address self-review findings"
```

Show a summary of what was fixed and what was intentionally skipped.

---

### Step 6 — Verify Checks (derived dynamically)

Don't assume `npm run build/lint/test`. Derive the exact checks this repo gates PRs on, then run them.

#### Step 6a — Determine the checks to run

1. **Detect the task runner / package manager.** Check the lockfile:
   `package-lock.json`→npm, `yarn.lock`→yarn, `pnpm-lock.yaml`→pnpm,
   `bun.lockb`/`bun.lock`→bun. Also note non-JS runners if present:
   `Makefile` targets, `justfile` recipes, `Taskfile.yml`, `composer.json`
   scripts, `pyproject.toml`/`tox.ini`, etc.

2. **Read the CI config** (fetched in Step 1) — this is the source of truth for
   what _must_ pass:
   - **GitHub:** for each `.github/workflows/*.{yml,yaml}` triggered by
     `pull_request` / `merge_group` / `push`, extract every `run:` command.
   - **GitLab:** for `.gitlab-ci.yml` (and `include:`d files), extract each
     job's `script:` commands. Skip jobs whose `rules:`/`only:`/`except:`
     scope them to branches/tags other than this PR.

3. **Reduce CI commands to local check commands.** Drop setup/install steps
   (`actions/checkout`, `npm ci`, `bundle install`, `pip install`, docker
   build/push, deploy, coverage upload, etc.). Keep the verification commands:
   lint, format-check, typecheck, build, unit/integration/e2e tests.

4. **Prefer the canonical script name.** If CI runs an inlined command that
   maps to a named script (e.g. CI runs `eslint .` and `package.json` has
   `"lint": "eslint ."`), run the named script via the detected package
   manager (`npm run lint`, `pnpm lint`, `bun run lint`, …). This keeps you
   aligned with how the repo expects checks to be invoked.

5. **No CI config?** Fall back to `package.json` scripts whose names match
   check patterns: `format`/`format:check`, `lint`, `typecheck`/`type-check`/`tsc`,
   `build`, `test`, `test:*`. For non-JS repos, fall back to obvious runner
   targets (`make lint`, `make test`, `just check`, …).

6. **Classify each derived check:**
   - **Writes files** (formatters: `prettier --write`, `gofmt -w`, `black .`,
     `eslint --fix`, a `format` script) → Wave 1, runs alone, first.
   - **Read-only** (lint, typecheck, build, tests) → Wave 2, runs in parallel.

Show the user the derived list before running if it's non-obvious (e.g. unusual
or many commands). Otherwise just proceed. Example:

```
Derived checks from .github/workflows/ci.yml + package.json:
  format  → npm run format        (writes files, runs first)
  lint    → npm run lint
  types   → npm run typecheck
  build   → npm run build
  test    → npm run test
```

#### Step 6b — Wave 1: formatter (writes files, runs alone)

Run the formatter check first because it modifies files lint/tests will read. If
any files changed, commit before continuing:

```bash
git diff --quiet || (git add -A && git commit -m "chore: apply formatter")
```

If no formatter was derived, skip Wave 1.

#### Step 6c — Wave 2: everything else in parallel

Launch every read-only check from the derived list simultaneously as background
jobs, each logging to its own file in a per-run scratch dir, and **capture each
job's exit code** so the result table is real (don't infer pass/fail from log
contents). Build this dynamically from Step 6a — the commands below are
illustrative, not fixed. **Run under bash** (the shell-agnostic loop below
avoids bash arrays so it also works under `sh`/dash):

```bash
# Per-run scratch dir: namespaced under /tmp/slynk and collision-safe.
mkdir -p /tmp/slynk/create-pr
WORKDIR=$(mktemp -d /tmp/slynk/create-pr/run.XXXXXX)

# Launch one background job per derived check. Record "name pid" pairs to a
# file instead of a bash array so the loop is shell-agnostic.
run_check() {  # run_check <name> <command...>
  name=$1; shift
  ( "$@" ) > "$WORKDIR/$name.log" 2>&1 &
  echo "$name $!" >> "$WORKDIR/jobs"
}
run_check lint  npm run lint
run_check types npm run typecheck
run_check build npm run build
run_check test  npm run test

# Wait for each job, recording its individual exit code.
while read -r name pid; do
  wait "$pid"; echo "$name $?" >> "$WORKDIR/status"
done < "$WORKDIR/jobs"
```

`$WORKDIR/status` now holds one `<name> <exit-code>` line per check (0 = pass).
Use it to build the table and to decide which checks failed.

Show all results together once every job finishes — don't interrupt mid-run:

```
✅ lint     (8s)
✅ types    (5s)
❌ build    (12s)  — 1 error
✅ test     (34s)
```

**Handling failures:** only prompt after all results are in. For each failed check:

> "`<check>` failed. Fix the issues and re-run, or skip this check and continue?"

Choices:

- **Fix and re-run** — auto-fix if straightforward (e.g. re-run the lint script with `--fix`), then re-run **only that check**
- **Skip this check** — continue (note in the PR description that this check was skipped)
- **Cancel** — stop

Clean up the scratch dir once resolved (removes only this run's files):

```bash
rm -rf "$WORKDIR"
```

Do not proceed to PR creation if any check failed and the user hasn't explicitly chosen to skip it.

---

### Step 6d — Generate Release Change File (if applicable)

Some repos use [beachball](https://microsoft.github.io/beachball/) for release management. Check:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
node -e "const p=require('$REPO_ROOT/package.json'); console.log(!!p.scripts?.['release:change'])"
```

**If no `release:change` script exists**, skip this step entirely.

**If beachball is found:**

Infer a change type from the branch prefix:

| Branch prefix                                      | Default |
| -------------------------------------------------- | ------- |
| `feat/`                                            | `minor` |
| `fix/`                                             | `patch` |
| `chore/`, `docs/`, `ci/`, `refactor/`              | `none`  |
| `breaking/` or description implies breaking change | `major` |
| Anything else                                      | `patch` |

Ask the user to confirm, inferred type first (marked Recommended): `patch`, `minor`, `major`, `none`.

Write the change file directly (skip the interactive `npm run release:change`) — beachball's format, filename `change/<sanitized-package-name>-<uuid-v4>.json` at the project root:

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
CHANGE_DIR="$REPO_ROOT/change"
mkdir -p "$CHANGE_DIR"

PACKAGE_NAME=$(node -e "console.log(require('$REPO_ROOT/package.json').name)")
EMAIL=$(git config user.email)
UUID=$(node -e "console.log(require('crypto').randomUUID())")
FILE_SAFE=$(echo "$PACKAGE_NAME" | sed 's/[^a-zA-Z0-9@]/-/g')

cat > "$CHANGE_DIR/${FILE_SAFE}-${UUID}.json" << EOF
{
  "type": "<confirmed-type>",
  "comment": "<pr-title>",
  "packageName": "$PACKAGE_NAME",
  "email": "$EMAIL",
  "dependentChangeType": "<confirmed-type>"
}
EOF

git add "$CHANGE_DIR/"
git commit -m "chore: add change file"
```

**In monorepos:** one change file per affected package (check which `packages/*/package.json` paths the diff touches), resolving `./package.json` from each package dir.

---

### Step 7 — Generate PR Description

Combine:

1. **PR template** (if found in Step 1): fill each section using the diff, commits, and Step 5 analysis.
2. **No template**: use the default structure below.

**Default structure:**

```markdown
## What

[1–2 sentences describing what this PR does, written as if explaining to a teammate who hasn't seen the code — not a commit log]

## Why

[1–2 sentences on the motivation: what problem this solves or what value it adds]

## Notable Changes

[Bullet list of functional changes a reviewer needs to understand — new capabilities, changed behavior, updated integrations, new config options, removed functionality. Do NOT include: test additions, lint fixes, formatting changes, internal refactors with no behavior change, or CI tweaks.]
```

**If a ticket/issue reference is present,** add a link, sourced in this order:

1. PR template has a ticket/issue field → fill using the template's link pattern.
2. Branch/commit references a platform issue (`#123`) → link it (`Closes #123`).
3. Branch has a ticket key (`ABC-123`) and the template shows an issue-tracker URL pattern → follow that pattern.
4. Otherwise omit — do not invent a URL.

**Tone:** Write it the way a senior engineer would — clear, direct, confident. No AI tells: no bullet-point breakdowns of obvious things, no over-explanation, no "This PR introduces…" or "In this PR, I have…". First person but natural, like Slack: "Adds X so that Y can Z." No em-dashes.

**Notable Changes — what qualifies:**

| ✅ Include                                 | ❌ Exclude                |
| ------------------------------------------ | ------------------------- |
| New API endpoints or function signatures   | Added/updated tests       |
| Changed business logic or calculation      | Lint fixes or formatting  |
| New configuration options                  | Internal variable renames |
| New UI components or screens               | Build script changes      |
| New integrations or external dependencies  | CI/CD pipeline tweaks     |
| Removed or deprecated functionality        | Minor code cleanup        |
| Performance changes with observable impact | Comment-only changes      |

---

### Step 8 — Review and Approve Description

Display the generated title and description together:

```
Title: feat: add widget

---
[full description]
```

Ask:

> "Ready to open the PR?"

Choices:

- **Open as ready for review** — create in ready state
- **Open as draft** — create in draft state
- **Edit the description first** — take changes, regenerate, ask again
- **Cancel** — stop

If the user requests edits, apply them and re-display before asking again.

---

### Step 9 — Push and Open PR

**Push the branch:**

```bash
git push origin <branch> --set-upstream
```

**Create the PR** using the detected platform's CLI. Write the description to a temp file first to avoid shell length limits and quoting issues:

```bash
mkdir -p /tmp/slynk/create-pr
# Trailing X's only — BSD/macOS mktemp leaves a non-trailing template literal,
# so no `.md` suffix here (the body-file's extension is irrelevant to gh/glab).
BODY=$(mktemp /tmp/slynk/create-pr/body.XXXXXX)
cat > "$BODY" << 'EOF'
<generated description>
EOF
```

**GitHub:**

```bash
gh pr create \
  --title "<generated title>" \
  --body-file "$BODY" \
  --base <base> \
  --head <current branch> \
  [--draft]                          # if draft was selected
```

**GitLab** (read the body from the file via stdin, for parity — avoids
re-introducing the shell-length/quoting risk that `--description "$(cat …)"`
would):

```bash
glab mr create \
  --title "<generated title>" \
  --description "$(cat "$BODY")" \
  --target-branch <base> \
  --source-branch <current branch> \
  [--draft] \
  --remove-source-branch=false
```

> If your `glab` version supports `--description-file`, prefer
> `--description-file "$BODY"` over the command substitution above.

```bash
rm -f "$BODY"
```

> **Note:** Don't manually assign reviewers — both platforms request reviews
> from CODEOWNERS automatically when the PR is opened.

Display the PR/MR URL after creation.

---

### Step 10 — Post-Creation Checklist

Check the diff for UI-layer changes — modified files in paths like:

- `**/components/**`, `**/views/**`, `**/pages/**`, `**/screens/**`
- Files ending in `.css`, `.scss`, `.less`, `.styled.ts`, `.styled.tsx`
- Any file with `ui`, `component`, `view`, `page`, `modal`, `drawer`, `button`, `form` in the name

If found, remind the user:

> "Looks like this PR includes UI changes — don't forget to attach screenshots or a short screen recording before requesting review."

---

## Tips

- Run early and often. A self-review is far cheaper than a round of review comments.
- The "Fix automatically" option in Step 5 is conservative — it won't make architectural decisions for you. Anything it skips is clearly noted.
- For very large diffs, scope the review: paste a filtered diff with "Review only changes under `src/components/`".
- Because checks are derived from CI config, this stays correct as the repo's pipeline evolves — no need to edit the skill when the build commands change.

## Notes on Secrets Scanning

The git host CLIs don't scan local diffs for secrets — that needs a dedicated tool. This skill uses `gitleaks` when installed and falls back to pattern-based grep otherwise. For reliable coverage:

```bash
brew install gitleaks   # macOS
# or see https://github.com/gitleaks/gitleaks for Linux/Windows
```

Once installed, `gitleaks` is used automatically on every run.
