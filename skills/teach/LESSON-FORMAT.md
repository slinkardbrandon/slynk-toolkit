# Lesson format

A lesson is one self-contained HTML file teaching one tightly-scoped thing,
completable in one sitting. Lessons are visited once; durable reference goes in
`reference/` instead.

## Hard requirements

- **Self-contained.** Inline CSS, no CDN dependencies, no build step. The file
  must render offline, years from now.
- **One concept.** If the outline needs "and", split it into two lessons.
  Working memory is the budget -- a lesson the user can't finish in ~15 minutes
  is too big.
- **Beautiful.** Think Tufte: generous whitespace, readable measure (~65ch),
  real typographic hierarchy, restrained palette. No framework look-alikes.
- **Cited.** Every factual claim links its source from RESOURCES.md. Recommend
  exactly one primary source for going deeper.
- **Cross-linked.** Link related lessons and reference docs by relative path.
- **Ends with retrieval.** Close with practice, not summary (see below).

## Structure

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>NNNN -- <concept></title>
    <style>
      /* inline, self-contained */
    </style>
  </head>
  <body>
    <header><!-- lesson number, concept, one-line mission tie-in --></header>
    <main>
      <!-- the teaching: prose, diagrams (inline SVG), worked examples -->
    </main>
    <section id="practice">
      <!-- retrieval practice: quiz or task (see Practice rules) -->
    </section>
    <footer>
      <!-- primary source, related lessons/reference links, -->
      <!-- "ask the agent a follow-up" reminder -->
    </footer>
  </body>
</html>
```

## Practice rules

- Quiz answers must not leak through formatting: every option the same number
  of words (and characters where possible), no odd-one-out styling.
- Interactive where plain JS allows (reveal-on-click, input checking); a
  written "do this, then tell the agent what happened" task otherwise.
- The feedback loop should be as tight as the medium allows -- in-page checking
  beats "check with the agent later".

## Difficulty calibration

Pitch each lesson just past the edge of the records' evidence (the zone of
proximal development): new enough to stretch, grounded enough to connect. For
**knowledge**, lower the difficulty -- clear prose, good examples. For **skill
practice**, difficulty is the tool -- retrieval, spacing, interleaving with
prior lessons' material.
