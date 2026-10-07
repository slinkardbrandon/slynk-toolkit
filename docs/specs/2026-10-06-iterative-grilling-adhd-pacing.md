<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# Iterative Grilling (ADHD-friendly pacing)

> Spec session -- 2026-10-06
> Prior art researched: superpowers, spec-kit /clarify, OpenSpec, grill-with-docs, BMAD (3 agents, 2026-10-06)
> Reviewed: baseline + cross-platform + interaction-design lenses (3 agents, 2026-10-06); revised to clear findings

## Summary

Replace slynk-spec's single-batch grilling with one-decision-per-roundtrip questioning with
hard per-decision size caps. The old batch style is grill-with-docs' frontier-round pattern and
produced unreadable walls. slynk-brainstorm's pacing language syncs in the same change.

## Key Decisions

- **One decision per roundtrip.** Batch 2-3 questions only when they resolve the same single
  decision and splitting them would be artificial. Matches spec-kit /clarify and OpenSpec explore.
- **Dependency ordering.** "Blocking" is an ordering word only: a decision other questions hang
  off gets asked first; questions downstream of an open answer wait. (grill-with-docs' frontier
  rule, applied one at a time.)
- **No question cap; stop when clear.** No surveyed tool targets an interaction count. Stop when
  all material questions are resolved or the user signals done ("done", "ship it", "stop
  asking"). Volume is limited by the materiality filter: ask only what changes architecture,
  data, tests, or UX; record the rest as stated assumptions. The user can request a full batch
  ("just give me all of them") -- honor it (OpenSpec's escape hatch).
- **Size caps are per decision -- detail is pull, not push.**

  | Unit                            | Cap                                   |
  | ------------------------------- | ------------------------------------- |
  | Question message (one decision) | ~10 lines / ~80 words                 |
  | Same-decision batch message     | ~12 lines, shared context stated once |
  | User-requested dump             | per-decision cap, per question        |
  | Paragraph                       | 2 sentences                           |
  | Context in a question           | 3 lines                               |
  | Recommendation                  | exactly 1 line                        |

  "why" / "more" / "expand" lifts the cap for that answer only.

- **Progress marker.** Each question message ends `(2 of ~4 -- next: <one-word teaser>)`; the
  final roundtrip (the nudge, when it runs, since it is counted last) ends `(4 of ~4 -- last
one)`. One-word teaser, never the full queue.
  - Estimate re-computed every roundtrip (answers add/remove questions), clamped to >= the
    current count, so the count never exceeds it.
  - New material question after "last one" was declared -> just keep going with markers
    re-expanded (`5 of ~6`); the estimate is an estimate.
  - The test-first nudge roundtrip is counted and carries a marker.
  - A same-decision batch is one roundtrip, one marker.
  - Suppressed in a user-requested full dump and in every roundtrip after that dump, the nudge
    included (the count is spent).
- **Context travels with questions.** The upfront findings dump is gone; each question carries
  only the context it needs. Opening message is exempt from the per-decision cap; its own element
  caps (template below) are the limit.
- **Recommendation leads, yes-able.** `My rec: X because Y.` -- "yes" accepts it (spec-kit's
  "yes/recommended" shortcut).
- **Structured-question UI, capability-gated, information parity.** If the runtime has a native
  option-prompt tool, discrete-option questions go through it; both paths carry the same
  information. Mapping:
  - Context lines -> question body; progress marker -> appended to the question text.
  - Recommendation -> first option labeled "(Recommended)"; its `because <Y>` rationale -> that
    option's description (no description slot -> appended to the question body).
  - Same-decision batch -> one prompt if the tool carries multiple questions per call;
    otherwise the text template.
  - Text path always: open-ended questions, the opening orientation/findings (sent as text
    before the first prompt), user-requested full dumps, runtimes without the tool.

  The shipped block names no specific tool -- same gating philosophy and phrasing style as the
  todo-list convention.

- **"Rules for questions" survives, all six bullets.** Never-ask-what-you-found,
  challenge-ambiguous-terms, challenge-against-glossary, scenario stress-tests, and
  surface-contradictions stay verbatim; the sixth ("every question includes your recommended
  answer") is reworded to cite the `My rec:` template line / "(Recommended)" option as the
  required form. Behavioral Rules' cross-reference to the subsection remains valid.
- **Test-first nudge is its own roundtrip, capped, counted.** Same intent, rewritten to fit the
  caps: one-line framing, 3-5 one-line scenario bullets, one-line closing question. The old
  multi-sentence blockquote wrapper does not survive; the section's surrounding prose (why
  corrections are high-value signal, the coverage-bar/proportionality note) is condensed to two
  sentences and kept.
- **Behavioral Rule 1 rewritten.** "Target 2-4 total user interactions" dies (no precedent in
  any surveyed tool); replaced by "keep each message small, not the session short" + stop
  conditions.
- **Brainstorm syncs now.** Its "batch only independent questions" bullet contradicts the new
  model; one PR keeps the cross-skill consistency lens quiet.

## Terms Clarified

- **Roundtrip**: one question message + one user reply. The unit grilling is paced in.
  _Avoid_: "round" (grill-with-docs' multi-question frontier round -- the rejected pattern).
- **Materiality filter**: session shorthand for "only ask what changes architecture, data
  modeling, test design, or UX behavior; everything else becomes a stated assumption". Dropped
  from shipped prose as jargon -- the SKILL.md states the rule plainly.
  _Avoid_: "question budget" (no numeric cap exists) and using the term in SKILL.md text.
- **Blocking (decision)**: ordering-only -- a decision other open questions depend on. Not the
  stop condition; stopping is governed by materiality + user signal.

## Test Cases

- Prose-only change: `npm test`, `npm run lint`, `npm run format:check` still pass.
- Smoke-read the **whole** of `skills/spec/SKILL.md`: no batch-era language survives anywhere
  ("single batch", "batched grilling", "grilling round", "answer what you can, skip what you're
  unsure about", "follow-up batch").
- Smoke-read: brainstorm's Phase 2 no longer says "batch only independent questions".
- Smoke-read: Behavioral Rules' cross-reference to Phase 2's "Rules for questions" still resolves
  to an existing subsection.

## Implementation Plan

### What we're building

See Summary. Two SKILL.md files change; no helper (.mjs) changes.

### Files to touch

- `skills/spec/SKILL.md` -- Phase 2 rewrite, Phase 0d wording, Behavioral Rule 1,
  `<what-to-do>` blurb.
- `skills/brainstorm/SKILL.md` -- Phase 2 pacing bullets + capability-gated question-UI line.

### skills/spec/SKILL.md changes

1. **`<what-to-do>`**: "asking targeted questions" stays; add "one decision per roundtrip".
2. **Phase 0d**: "you expect a real grilling round, not a one-shot answer" -> "you expect a real
   grilling, not a one-shot answer".
3. **Phase 2 renamed** "Batched Grilling" -> "Iterative Grilling". New structure, in order:
   - **Opening message template** (verbatim; exempt from the per-decision cap, these element
     caps are the limit):

     ```
     <2-3 sentences: what we're building and the shape you found.>

     Already answered by the code (not asking):
     - <finding -- one line> (max 4 bullets, most relevant first, trim the rest; omit section
       if none)

     **<Question 1>?**

     <max 3 lines of context>

     My rec: <X> because <Y>.

     (1 of ~<est> -- next: <one-word teaser>)
     ```

     No material questions at all -> opening is orientation + findings only, then straight to
     the test-first nudge (or the plan, if the nudge has nothing either). On the structured
     path the opening stops after the findings bullets and question 1 goes through the prompt
     tool (unless question 1 is open-ended -- then it stays in the opening text). The opening's
     own element caps (2-3 sentence intro included) override the general paragraph cap.

   - **Per-question message template** (verbatim):

     ```
     **<Question>?**

     <max 3 lines: only the context this question needs>

     My rec: <X> because <Y>.

     (<n> of ~<est> -- next: <one-word teaser>)
     ```

     Final roundtrip (whichever hits `n == est`; normally the nudge): the marker reads
     `(<n> of ~<n> -- last one)`.

   - **Same-decision batch template** (2-3 questions resolving one decision; ~12 lines max):

     ```
     **<The decision>?** (one decision, <k> sub-questions)

     <max 3 shared context lines>

     1. <sub-question, one line> -- my rec: <X> because <Y>.
     2. <sub-question, one line> -- my rec: <X> because <Y>.

     (<n> of ~<est> -- next: <one-word teaser>)
     ```

     "yes" accepts all sub-recs; answering by number ("yes to 1, B for 2") splits them. `<k>`
     is the sub-question count, `<n>`/`<est>` the roundtrip count as everywhere else. Marker
     rules apply to every template (an est=1 opening reads `(1 of ~1 -- last one)`).

   - **Size caps + pull-not-push rule**: ~10 lines / ~80 words per decision; no paragraph over
     2 sentences; "why" / "more" / "expand" lifts the cap for that answer only.
   - **Capability-gated structured-question block** -- this text ships in the SKILL.md (tool-name
     abstinence included, like the todo-list convention's wording):

     > If your runtime has a structured option-prompt tool (clickable options; the name varies
     > per runtime), present each discrete-option question through it: context in the question
     > body, progress marker appended to the question text, your recommendation as the first
     > option marked "(Recommended)" with its because-rationale in that option's description
     > (no description slot -> append it to the question body), real alternatives after --
     > never yes/no padding. A same-decision batch rides one prompt only if the tool carries
     > multiple questions per call; otherwise its text template. Open-ended questions, the
     > opening orientation (text sent before the first prompt), and user-requested full dumps
     > use the text templates. On the structured path the opening message stops after the
     > findings bullets; question 1 goes through the prompt tool (open-ended question 1 stays
     > in the opening text). No such tool -> text templates throughout. Both paths carry the
     > same information.

     The no-tool-names rule is author guidance, satisfied by the block's "the name varies per
     runtime" phrasing -- it is not itself shipped prose.

   - **Ordering rules**: dependency order (a decision other questions hang off goes first;
     downstream questions wait for its answer); among the currently askable questions (nothing
     upstream still open), highest impact x uncertainty first. "Blocking" is ordering
     vocabulary only.
   - **Batch exception**: 2-3 questions in one message only when they resolve the same single
     decision (template above; keeps its one marker). User-requested full batch: honor it in
     text form; present questions downstream of unanswered ones with conditional phrasing
     ("If Q2 = A: ..."); per-decision caps hold; suppress progress markers in the dump and in
     every roundtrip after it (the count is spent).
   - **Rules for questions**: all six bullets kept -- five verbatim (never-ask-what-you-found,
     challenge ambiguous terms, challenge against the glossary, scenario stress-tests, surface
     contradictions); the recommended-answer bullet reworded to cite the `My rec:` line /
     "(Recommended)" option as the required form. Behavioral Rules' cross-reference stays.
   - **Stop conditions**: all material questions resolved, or the user signals done ("done",
     "ship it", "stop asking"). Leftover immaterial gaps -> stated assumptions in the plan.
     Progress estimate re-computed every roundtrip.
   - **"Follow-up rounds" section deleted** (batch-era); the stop conditions replace the
     two-round limit.
   - **Test-first nudge**: its own roundtrip, never merged into a question message; counted in
     the progress estimate and carries a marker (dropped, like all post-dump markers, when a
     user-requested full dump preceded it). Replace the blockquote template with a capped
     version: one-line framing ("Before code -- I think these behaviors matter; tell me where
     I'm off:"), 3-5 one-line scenario bullets, one-line closing question. The section's
     surrounding prose (corrections are high-value signal; keep scenarios proportional to the
     repo's coverage bar) condenses to two sentences and stays. Caps bind this message like any
     other.

4. **Behavioral Rule 1** replaced: "Keep each message small, not the session short. No roundtrip
   cap -- stop when all material questions are resolved or the user signals done. The materiality
   filter limits volume: ask only what changes architecture, data, tests, or UX; record the rest
   as assumptions."

### skills/brainstorm/SKILL.md changes

- Replace "Batch only independent questions (answering one doesn't change another); ask
  interdependent ones in sequence." with two bullets: one decision per roundtrip (batch only
  same-decision questions), dependency ordering (ask the decision other questions hang off
  first) -- same vocabulary as spec's Phase 2, condensed.
- Add the capability-gated question-UI bullet, shipped verbatim as: "If your runtime has a
  structured option-prompt tool (the name varies per runtime), present discrete-option
  questions through it -- recommendation as the first option marked '(Recommended)', rationale
  in its description. A same-decision batch rides one prompt only if the tool carries several
  questions per call. Open-ended questions and runtimes without such a tool use plain text."
- "Keep it short -- a few roundtrips, not an interrogation." stays -- brainstorm is divergent;
  its session-length instinct is fine.

### Patterns to follow

- Capability-gating wording mirrors the todo-list convention block (spec SKILL.md Phase 0d).
- Tone per AGENTS.md: the template text itself must be slim, no hedging.

### How to verify

- `npm run lint`, `npm run format:check`, `npm test` pass.
- `npm run install:local` re-run after SKILL.md edits (templated copies are stale until then).
- Manual smoke: next `slynk-spec` run on a real task grills one decision at a time with
  progress markers (aspirational check, no harness; the mechanical checks are the Test Cases
  smoke-reads).

### Assumptions

- `.github/copilot-instructions.md` and AGENTS.md review lenses don't mention question pacing;
  no checklist sync needed.
- No other skill grills users; slynk-spec-review, create-pr, handoff untouched.
- CONTEXT.md glossary additions (Roundtrip, Materiality filter, Blocking) offered separately at
  session end, not part of this change.
