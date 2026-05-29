Spec out slynk-toolkit's spec-review skill. Less blocked than pr-review/pr-triage — its input lives in-repo.

Read first:

- docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 2 entry)
- plugins/slynk/skills/spec/SKILL.md (the artifact format it reviews)
- CLAUDE.md (tone rules = review criteria)

Use the /spec skill.

Goal: a skill that reviews a /spec ARTIFACT for QUALITY — inconsistencies, tone, redundancy, wordiness, accuracy, completeness — and surfaces missed concerns. It's the critic to /spec's author; it reviews /spec's own output. Works on your specs, other people's specs, or via agent fan-out for independent triage (each agent pressure-tests from a different lens, then synthesize).

CRITICAL distinction — do not conflate: there's a machine-local `review-spec` skill that judges INTENT-FIT (does the design solve the ticket?). This new slynk skill judges ARTIFACT QUALITY. Different surface, different criteria.

Design notes: reuse /spec's tone rules (CLAUDE.md — no AI-isms, no em-dashes, concise, bullets over prose) as concrete review criteria. The fan-out triage pattern was exercised in this repo's session (five agents reviewing the toolkit from different perspectives) — use that as the reference shape for multi-agent mode. Produce the spec artifact, then the resume prompt.
