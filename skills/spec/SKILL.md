---
name: spec
description: >-
  Stress-test a plan BEFORE building it: explore the codebase, ask only the
  questions the code can't answer (each with a recommendation), and produce a
  structured spec. Use when the user wants to spec something out, plan an
  approach, or "grill"/pressure-test a plan before non-trivial work, e.g.
  "let's spec this out", "help me plan X", "poke holes in this". Not for a
  fuzzy, unshaped idea with no direction yet; use the brainstorm skill to
  diverge first. Not for capturing a finished session to continue elsewhere;
  use the handoff skill for that.
argument-hint: issue number, owner/repo#n, or a description (optional)
---

<what-to-do>

Stress-test the user's plan by exploring the codebase, asking targeted
questions about gaps the code can't answer, and producing a structured
implementation plan with a paste-ready handoff prompt.

If the codebase already answers a question, state what you found instead of
asking. The user should only be interrupted for genuine decisions. (Question
discipline and behavioral rules live in Phase 2 and the Behavioral Rules
section.)

</what-to-do>

<supporting-info>

## Inputs

```
/spec                              -- describe what you're working on
/spec 142                          -- GitHub issue in this repo: fetch it, explore gaps
/spec owner/repo#142               -- issue in another repo
/spec "migrate X to use Y"         -- inline description
```

If an upstream `/brainstorm` session handed off a seed (chosen direction,
approaches considered, research findings, new terms), consume it as-is, no
parsing needed -- whether it arrives as the inline description above (pasted
into a fresh session) or as the framing from a brainstorm continuing in this
same session. Its "approaches considered" and "research findings" feed Phase 2
grilling and the Key Decisions rationale; don't drop them.

---

## Phase 0 -- Load Context

Gather all available context silently before engaging the user.

### 0a -- Fast context gather (single command)

Run the helper to collect repo metadata, convention files, spec
history, and config in one shot:

```bash
node "{{SLYNK_DIR}}/spec-context.mjs"
```

> `{{SLYNK_DIR}}` is expanded by the installer to this skill's absolute install
> dir, so the helper runs by absolute path -- no PATH lookup. If the command
> isn't found, the toolkit isn't installed: run `npx slynk-toolkit` (or
> `npm run install:local` from a clone). The sibling helper
> (`write-spec-artifact.mjs`) uses the same `{{SLYNK_DIR}}` token.

This outputs a JSON blob containing:

- `repo`: root path, name, default branch
- `conventions`: content of CLAUDE.md, AGENTS.md, CONTRIBUTING.md, CONTEXT.md, etc.
- `instructions`: content of `.github/instructions/*.instructions.md` (if present)
- `specHistory`: last 5 spec artifacts (filename + preview)
- `config`: output_dir and context_file settings
- `packageScripts`: available npm scripts

Parse this and use it throughout the session. If the script reports it is not
in a git repo, fall through to 0b. Read the CONTEXT.md glossary (if present in
`conventions`) carefully -- you will challenge new terms against it during
grilling (see Phase 2).

### 0b -- Not in a repo

If `spec-context.mjs` reports it is not in a git repo, ask the user which
repo to work in (or to `cd` there) before continuing. If the issue was given
as `owner/repo#n`, use that repo.

### 0c -- Fetch issue (if reference provided)

If the user passed a GitHub issue (`142`, `#142`, `owner/repo#142`, or a
full issue URL), fetch it:

- **If a GitHub MCP server is configured**, use it to read the issue.
- **Otherwise use the `gh` CLI:**
  ```bash
  gh issue view <number> --repo <owner/repo> --json title,body,labels,comments,url
  ```
  (Omit `--repo` when the issue is in the current repo.)
- Extract: title, body, acceptance criteria, labels, comments.
- Note any ambiguities, missing detail, or conflicting information in comments.
- **Follow references** -- read linked issues and any referenced PRs. They
  often carry the bigger picture or prior art that makes individual
  decisions clearer.

If neither a GitHub MCP nor `gh` is available, ask the user to paste the
issue description manually. Do not block -- the spec can still work from a
text description.

---

## Phase 1 -- Silent Exploration

Launch exploration (sub-agents or direct) to build understanding. Do not
engage the user yet.

### What to explore:

- **Files/components** the issue or description references -- read the file
  itself, plus sibling components, the router/index that imports it, the
  schema for any data it touches, and test files that cover the area
- **Existing patterns** -- how similar work was done before in this repo
- **Test patterns** -- what utilities, patterns, and coverage exist in the area.
  Note the testing framework, assertion style, mock patterns, and any shared
  test helpers. Identify what's already tested vs. what gaps exist.
- **Recent PRs** -- what changed recently in the affected area (use
  `gh pr list --state merged --limit 5` filtered to the affected path)
- **Ambiguous terms** -- if the description says "checkout error", find every
  component that could mean (CheckoutError? ErrorBoundary? PaymentFailedPage?)

### What to note internally:

- Terms that are ambiguous or overloaded → will ask about these
- Decisions the code already answers → will state these, not ask
- Gaps where no pattern exists → will ask for preference
- Contradictions between issue and code → will surface these
- **Testable behaviors** -- as you explore, identify concrete scenarios that
  should have test coverage. Think: what could break? What are the
  meaningful behaviors a user or consumer of this code cares about? What
  edge cases did the existing tests miss?

### CONTEXT.md tracking

If during exploration you encounter domain terms that are project-specific
and worth capturing (not general programming concepts), begin building an
internal running list. These will be offered to the user at the end.

Criteria for capturing a term:

- Specific to this project's domain (not generic like "timeout" or "retry")
- Has been or could be confused with something else
- Multiple words exist for the same concept in the codebase

If a CONTEXT.md glossary already exists (from Phase 0), note any term the
user or issue uses that **conflicts with or duplicates** an existing
definition -- you will surface these during grilling.

---

## Phase 2 -- Batched Grilling

Present your understanding and ask targeted questions in a single batch.

### Structure of the prompt:

```
I've read the issue and explored the code. Here's what I understand:

[2-4 sentence summary of what needs to happen, using terms from the code]

[If contradictions found]: I noticed <code does X> but the issue says
<Y> -- I'll ask about that below.

A few questions to sharpen the plan. Answer what you can, skip what
you're unsure about:

1. [Question] -- I'd recommend [X] because [reason from code].
2. [Question] -- I'd recommend [X] because [reason from code].
3. [Question about ambiguous term or scope]
4. [Question about verification / "what does done look like?"]
```

### Rules for questions:

- **Every question includes your recommended answer.** The user can say
  "yes" or push back -- either is faster than open-ended.
- **Never ask what you already found.** If the code answers it, state it.
- **Challenge ambiguous terms.** "You said 'error page' -- do you mean the
  `ErrorBoundary` component, the standalone `/error` route, or the inline
  `PaymentFailedPage`? The code has all three."
- **Challenge against the glossary.** If a term the user uses conflicts with
  or duplicates a definition already in CONTEXT.md, surface it: "You said
  'session' -- CONTEXT.md defines that as the server-side auth session; do
  you mean that, or the client-side cart session?"
- **Stress-test with scenarios.** "What happens if the auth token expires
  mid-mutation AND the user is on the standalone `/error/` path?"
- **Surface contradictions.** "The issue says X, but the code currently
  does Y -- which is the source of truth?"

### Follow-up rounds:

If the user's answers reveal additional complexity or new questions, ask
**one** focused follow-up batch. Do not loop indefinitely -- if you still
have gaps after two rounds, note them as assumptions in the plan and move on.

If the user's answers are clear and complete after round one, skip the
follow-up entirely.

### Test-first nudge:

Surface 3-5 test scenarios you identified during exploration, framed as your
assumptions (you don't have full business context, so the user must validate or
correct them). The goal is to think through meaningful behaviors before code,
not to chase coverage metrics.

> "Before we write code, I want to make sure we're testing the right things.
> Based on what I see in the spec, here's what I _think_ matters -- but I'm
> making assumptions about intent, so tell me where I'm off:
>
> - <scenario 1 -- what you assume matters and why>
> - <scenario 2>
> - <scenario 3>
>
> Am I reading the intent right? Anything here that doesn't actually matter,
> or something important I'm not seeing?"

A correction like "scenario 2 doesn't matter, you're missing X" is high-value
signal. The validated scenarios go into the spec artifact and handoff prompt so
the implementing agent writes them first, not as an afterthought. If the repo
enforces a coverage bar, respect it but keep scenarios proportional -- for
config/infra changes, "existing tests still pass" is a fine test case.

---

## Phase 3 -- Plan Generation

Synthesize everything into a structured implementation plan. Do not engage
the user -- just produce this.

### Plan format:

```markdown
## Plan: <short title>

### What we're building

<1-3 sentences: the what and why>

### Approach

1. <high-level step -- one sentence, no file paths>
2. <high-level step>
3. <high-level step>

### Key decisions

- <decision made during the spec session, with rationale>
- <decision made during the spec session>

### Files to touch

- `src/path/to/file.ts` -- <what changes and why>
- `src/path/to/other.ts` -- <what changes>
- `src/path/to/test.ts` -- <what test coverage to add>

### Test cases

- <scenario to test -- written as a test title, e.g. "rejects expired tokens
  with a 401 even if the refresh endpoint is unreachable">
- <edge case or failure mode worth covering>
- <integration point to validate>

### Patterns to follow

- <existing pattern in repo to match, with file reference>
- <convention from CONTRIBUTING.md or similar>

### How to verify

- <concrete verification: "tests pass", "endpoint returns X", etc.>
- <manual check if applicable>

### Assumptions (if any)

- <gaps that weren't fully resolved, with the assumption made>
```

---

## Phase 4 -- Approval

Show the plan and offer choices:

> Here's the implementation plan. Does this look right?

Choices:

- **Looks good -- generate the handoff prompt**
- **Needs changes** -- (freeform: what to adjust)
- **Scope is too big -- help me break it down** (→ break it into smaller pieces)
- **Just start implementing here** (→ skip handoff, begin work in this session)

If "needs changes" → revise the plan and re-present once. If still not
right after the second pass, ask the user to specify exactly what's off.

If "just start implementing" → treat the plan as your spec and begin
implementation directly. Skip Phases 5 and 6.

---

## Phase 5 -- Handoff Prompt & Spec Artifact

### 5a -- Write spec artifact

Use the helper to write the artifact to the configured output directory. Write
the content to a scratch file first, then pass it with `--content` -- piping via
`echo` breaks on apostrophes and newlines, which prose is full of. The helper
runs by absolute path via the `{{SLYNK_DIR}}` token, same as the Phase 0a helper:

```bash
mkdir -p /tmp/slynk/spec
# Trailing X's only (BSD/macOS mktemp), per-run file so concurrent specs don't collide.
SCRATCH=$(mktemp /tmp/slynk/spec/artifact.XXXXXX)
cat > "$SCRATCH" << 'EOF'
<artifact content>
EOF
node "{{SLYNK_DIR}}/write-spec-artifact.mjs" --slug "<slug>" --content "$SCRATCH"
rm -f "$SCRATCH"
```

The slug should be 3-5 words, kebab-case, derived from the issue or topic.
The script handles date-stamping, directory creation, and config resolution
automatically. It returns the written path as JSON.

Example: slug `suppress-auth-errors` → `docs/specs/2026-05-29-suppress-auth-errors.md`

#### Artifact contents:

```markdown
# <Title>

> Spec session -- <date>
> Issue: <#NNN link if applicable>

## Summary

<2-3 sentences: what was discussed and decided>

## Key Decisions

- <decision 1 -- what and why>
- <decision 2>

## Terms Clarified

- **<term>**: <definition as clarified during the spec session>
  _Avoid_: <alternative terms that are ambiguous>

## Test Cases

<scenarios identified during the spec session that should be tested>

- <behavior to verify -- written as a test title, e.g. "rejects expired tokens
  with a 401 even if the refresh endpoint is unreachable">
- <edge case or failure mode>
- <integration point>

## Implementation Plan

<the full plan from Phase 3>
```

The spec doc does NOT include the resume prompt itself -- that's ephemeral
execution context, not a durable design record.

### 5b -- Emit the resume prompt

The spec artifact (5a) holds the detail. Present a short, paste-ready prompt
that points a fresh session at it -- do **not** restate the plan inline. This
shares its format with the `/handoff` skill.

```
Implement the spec from the planning session. Read it first:

  docs/specs/<filename>.md
<if issue>  GitHub issue: <url>

It has the plan, key decisions, and test cases. Write the tests first, then
implement. Run lint and tests after each major step.
```

### 5c -- Offer exit ramps

After presenting the resume prompt:

> Prompt is ready and the spec doc has been saved. What's next?

Choices:

- **I'll paste this into a fresh session** -- done, session complete
- **File as a GitHub issue** -- create one with this context via `gh issue create`
- **Break into smaller pieces** -- split this plan into separate units of work
- **Just start implementing here** -- begin work in this session

For a fuller session capture (current state, decisions, next steps) rather
than just the spec pointer, run `/handoff`.

---

## Phase 6 -- Optional CONTEXT.md Glossary

If terms were clarified during the session that would benefit future agents
or developers working in this codebase:

> "During our conversation, I noted these domain terms worth capturing:
>
> - **<term>**: <definition>
> - **<term>**: <definition>
>
> Want me to add these to CONTEXT.md?"

If the user says yes:

- If `CONTEXT.md` exists → append terms under the appropriate section
- If it doesn't exist → create it with the format below

If the user says no → skip. Never force.

### CONTEXT.md format (if created):

```markdown
# <Project Name>

<One sentence: what this project is>

## Language

**<Term>**:
<1-2 sentence definition of what it IS>
_Avoid_: <ambiguous alternatives>

**<Term>**:
<definition>
_Avoid_: <alternatives>
```

Rules for CONTEXT.md:

- Only project-specific domain terms (not "timeout", "retry", "middleware")
- One or two sentences max per definition
- Be opinionated -- pick the canonical term, list others as "Avoid"
- No implementation details -- this is a glossary, not a spec

---

## Configuration

The skill checks for a `.spec.yml` file at the repo root for overrides.
All settings are optional -- sensible defaults are used if no config exists.

```yaml
# .spec.yml (all fields optional)
output_dir:
  docs/specs # where spec artifacts are saved
  # default: docs/specs
context_file:
  CONTEXT.md # glossary file path (false to disable)
  # default: CONTEXT.md
```

If no config file exists, use defaults silently. Do not prompt the user to
create one.

---

## Behavioral Rules

These apply throughout the entire session. For question discipline --
recommend rather than ask, never ask what you can look up, challenge ambiguous
terms (including against the CONTEXT.md glossary), stress-test with concrete
scenarios, surface contradictions -- follow Phase 2's "Rules for questions."
Beyond those:

1. **Keep it fast.** Target 2-4 total user interactions. If you have enough
   after the first batch, skip the follow-up.

2. **Respect repo conventions.** The plan and handoff prompt should reflect
   the repo's actual patterns (naming, file structure, test approach), not
   generic best practices.

3. **The spec doc is the artifact.** Everything important from the
   conversation gets captured there. The user should never need to re-explain
   a decision that was made during the spec session.

4. **Think test-first.** See Phase 2 -- surface the meaningful behaviors this
   change introduces as concrete test cases, framed as behaviors ("renders
   error state when API returns 500"), not implementation checks ("calls
   setError with true").

</supporting-info>
