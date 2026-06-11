# Learning record format

A learning record is the teaching workspace's ADR: a dated, numbered note of
something now known about the learner. Records are how a fresh session computes
where to pitch the next lesson -- write them stingily and trust them fully.

## When to write one

Only on real signal, never on exposure:

- **Evidence of understanding** -- the user passed retrieval practice, explained
  a concept back correctly, or applied it unprompted. Reading a lesson is not
  evidence.
- **Disclosed prior knowledge** -- "I already know X from work".
- **A corrected misconception** -- record both the wrong model and the fix.
- **A mission shift** -- the why changed; note what changed and update
  MISSION.md alongside.

## Format

`learning-records/NNNN-<slug>.md` (written via `write-lesson.mjs --kind record`):

```markdown
# LR-NNNN: <one-line claim about the learner>

Date: YYYY-MM-DD
Status: active
Kind: evidence | prior-knowledge | misconception | mission-shift

## What happened

<2-4 sentences: the observable signal, not an interpretation. Quote the
user where it matters.>

## What it means for teaching

<1-2 sentences: how the next lessons should change.>

Refs: <lesson files or conversation context that produced the signal>
```

## Rules

- One claim per record. Two insights = two records.
- Never delete or edit a stale record -- supersede it: set
  `Status: superseded by LR-NNNN` and write the new one. The trail of corrected
  models is itself teaching signal.
- Records describe the learner, not the curriculum. "User confuses borrowing
  with moving" belongs here; "next lesson: lifetimes" does not.
