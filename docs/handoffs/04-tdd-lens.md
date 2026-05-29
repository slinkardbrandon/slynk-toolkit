Spec out slynk-toolkit's /tdd mindset lens and its wiring into /spec. Depends on bootstrap + todo-convention.

Read first:

- docs/specs/2026-05-29-slynk-roadmap-mechanisms.md
- CONTEXT.md ("mindset lens", "work classification")
- plugins/slynk/skills/spec/SKILL.md (esp. the Phase 2 test-nudge)

Use the /spec skill.

Goal: a short standalone /tdd skill that's a TESTING-MINDSET LENS, not an executor — shapes how to think about what to test (real behaviors not coverage; fail-first: write the test that reproduces the break, THEN fix). Core instinct: when something breaks, write a test that shows the break, then fix.

Two NON-NEGOTIABLE steers from the workflow review:

1. SWAP, don't layer. /spec already has a test-first nudge in Phase 2. Add a work-classification step (bug | feature | chore/config | ticket-only). bug/feature SWAPS that nudge for the tdd lens content; chore/config/ticket-only DROPS it. Don't run two test-thinking passes.
2. LENS NOT EXECUTOR. Inline the lens CONTENT into spec's test step rather than a skill-to-skill invoke — a real /tdd invocation tempts the agent to start writing tests mid-spec, exactly what the lens is not. Mechanical inlining also moots the "is the conditional reliable?" soft spot.

/tdd still exists standalone (fire it directly when something breaks). No delete-and-restart absolutism. Produce the spec artifact, then the resume prompt.
