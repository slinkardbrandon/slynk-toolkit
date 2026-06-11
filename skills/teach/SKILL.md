---
name: teach
description: >-
  Teach the user a topic across sessions from a persistent teaching workspace:
  a mission, curated resources, beautiful self-contained HTML lessons, and
  learning records that track what the user actually knows. Use when the user
  wants to learn or study something over time, e.g. "teach me X", "I want to
  learn Y", "continue my lessons", "quiz me on what we covered". Stateful by
  design -- it expects to run in a workspace dir and to be invoked again. Not
  for a one-off question with a direct answer -- just answer it. Not for
  shaping project work (use slynk-brainstorm) or planning an implementation
  (use slynk-spec).
argument-hint: what to learn, or blank to continue from the workspace
---

<what-to-do>

Teach one user one topic over many sessions. The current directory is the
**teaching workspace** -- mission, resources, lessons, and learning records all
live there as files, so any future session (or another agent) picks up exactly
where this one left off. Each session: load the workspace, find the edge of
what the user knows, teach one tightly-scoped lesson just past that edge,
practice it, and record any real evidence of understanding.

Build **storage strength** (durable recall), not fluency theater: retrieval
practice, spacing, interleaving. The user feeling fluent at the end of a lesson
is not the goal; remembering it next month is.

</what-to-do>

<supporting-info>

## Inputs

```
/teach                       -- continue from the workspace's current state
/teach "rust ownership"      -- start (or steer) a topic
/teach "quiz me"             -- retrieval practice over past lessons
```

## Phase 0 -- Load the workspace

One helper call:

```bash
node "{{SLYNK_DIR}}/teach-workspace.mjs"
```

> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir. If the command
> isn't found, the toolkit isn't installed -- run `npx slynk-toolkit`.

Returns one JSON blob: `exists` (is this a workspace?), `mission`, `resources`,
`notes`, `glossary`, `lessons` + `records` (numbered, with record previews),
`reference`, and `next` artifact numbers.

- **`exists: false`** -> this dir is not a workspace. Confirm it's where the
  user wants their learning files (suggest a dedicated dir if it looks like a
  code repo), then scaffold:

  ```bash
  node "{{SLYNK_DIR}}/teach-workspace.mjs" --scaffold
  ```

- **`exists: true`** -> read the mission, skim record previews (read in full
  only the ones that matter today), and orient: what does the user demonstrably
  know, and what's next?

Track the session loosely (orient -> teach -> practice -> record) -- a task
list where you have one, otherwise nothing. The flow shifts with the user, so
don't lock a rigid plan. Honor any preferences in `notes`.

## Phase 1 -- The mission

The mission is _why_ the user is learning -- one per workspace. A bad mission is
worse than no mission, because every lesson silently optimizes for the wrong
thing.

- **Missing or vague** ("get fitter", "learn AI") -> your first job is the
  interview, not a lesson: what triggered this? what would you do with it? when
  is it real? Concrete beats aspirational -- "run a half marathon by October"
  beats "get fitter". Write the result to `MISSION.md`.
- **Present and concrete** -> restate it in one line and move on. If today's
  request contradicts it, surface the conflict -- a mission shift gets a
  learning record (`Kind: mission-shift`) and a `MISSION.md` update.

## Phase 2 -- Resources before teaching

Never teach from parametric memory alone -- gather and curate real sources
into `RESOURCES.md` first, annotated, split `## Knowledge` (docs, books,
courses) and `## Wisdom (Communities)` (forums, subreddits, local groups --
offer, never push; respect an opt-out). Keep `## Gaps` honest: what you
couldn't source yet.

- **Web tools available** (check your own tool list) -> research directly, or
  fan out parallel research agents if you have a subagent primitive: each gets
  a specific query and returns distilled findings -- claim + URL, no page
  dumps.
- **No web tools** -> say so plainly, teach from what you have, and list what
  needs verification under `## Gaps`. Never silently present unverified
  parametric knowledge as sourced.

Re-curation is incremental: most sessions, resources are already there and
this phase is a no-op.

## Phase 3 -- Teach: one lesson

Pick the next concept at the **zone of proximal development**: just past the
edge of what the records prove, connected to what's already known. One
tightly-scoped concept -- if the outline needs "and", split it.

Write the lesson as one self-contained HTML file per
[LESSON-FORMAT.md](LESSON-FORMAT.md) (Tufte-clean, cited from RESOURCES.md,
cross-linked, ends with retrieval practice). Write content to a scratch file,
then hand it to the helper -- never pipe prose through `echo`:

```bash
mkdir -p /tmp/slynk/teach
SCRATCH=$(mktemp /tmp/slynk/teach/lesson.XXXXXX)
cat > "$SCRATCH" << 'EOF'
<lesson html>
EOF
node "{{SLYNK_DIR}}/write-lesson.mjs" --kind lesson --slug "<slug>" --content "$SCRATCH" --open
rm -f "$SCRATCH"
```

(Non-POSIX shell? Write the scratch file with your runtime's file-write tool
and pass its path -- the helper only needs a readable file or stdin.)

The helper numbers the file (`lessons/NNNN-<slug>.html`) and opens it in the
browser where the platform allows; `opened: false` -> give the user the path
instead. Then stay available -- the lesson tells the user to bring follow-up
questions back to you.

Durable lookup material (cheat sheets, glossaries-as-tables, setup steps) goes
to `reference/` (`--kind reference`, a living doc, revisited and rewritten) --
lessons are visited once.

## Phase 4 -- Practice and record

Lessons end with retrieval practice; you close the loop:

- Quiz answers give nothing away through formatting (equal-length options).
- For skills (vs knowledge), prefer a real task with the tightest feedback
  loop available -- run the code, check the output, guide the next attempt.
- Space and interleave: open sessions by retrieving prior lessons' material
  before new content. The `/teach "quiz me"` entry point is exactly this.

When -- and only when -- there's real signal (passed retrieval, disclosed prior
knowledge, a corrected misconception, a mission shift), write a learning
record per [RECORD-FORMAT.md](RECORD-FORMAT.md), via a fresh scratch file
(same pattern as Phase 3):

```bash
node "{{SLYNK_DIR}}/write-lesson.mjs" --kind record --slug "<slug>" --content "$SCRATCH"
```

Reading a lesson is not evidence. Supersede stale records
(`Status: superseded by LR-NNNN`); never delete them.

## Glossary

`GLOSSARY.md` is the workspace's canonical language. Add a term only once the
user demonstrably understands it (record-level evidence), with the canonical
form and an _Avoid_ line for ambiguous aliases. Challenge new conversation
terms against it -- same discipline as a repo CONTEXT.md.

## Rules (every session)

- **The workspace is the memory.** Anything worth keeping lands in a file;
  assume this conversation is gone tomorrow.
- **Mission first.** No mission, no lessons -- the interview is the lesson.
- **Derive, don't invent.** Teaching comes from curated resources; gaps are
  declared, not papered over.
- **One concept per lesson, evidence per record.** Small artifacts, written
  stingily, trusted fully.
- **Storage strength over fluency.** Retrieval, spacing, interleaving --
  difficulty is the enemy for acquiring knowledge, the tool for practicing
  skills.
- **Cross-agent.** This file + two helpers load everywhere; browser-open and
  research fan-out degrade gracefully (path instead of open, declared gaps
  instead of web research); text-only always works.
- **Own one thing.** Teach teaches. Shaping work is `slynk-brainstorm`;
  planning a build is `slynk-spec`.

</supporting-info>
