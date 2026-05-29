Spec out slynk-toolkit's bootstrap dial. Independent of the other mechanism specs — parallelizable.

Read first:

- docs/specs/2026-05-29-slynk-roadmap-mechanisms.md
- CONTEXT.md ("bootstrap mode" is defined)

Use the /spec skill.

Goal: ship superpowers' session-bootstrap MECHANISM without its forced ceremony. A `.slynk.yml` `bootstrap: suggest | force | off`, default `suggest`. On Claude Code a SessionStart hook injects a "here's how to find skills, check before acting" preamble; on other agents AGENTS.md / instructions files carry the same nudge.

Locked: ship the mechanism, default suggest, dialable to force. suggest = lightweight nudge; force = the 1%/MUST language.

Primary design risk (workflow review): `force` is the highest ceremony risk and has NO natural trigger — set-once-and-forget, nags on unrelated sessions. Keep suggest/off as the real product; treat force as a de-emphasized escape hatch; scope force language to skill-relevance, NOT a blanket "you MUST check skills" every session. The whole ballgame: how does force read WITHOUT superpowers' persuasion-table heaviness?

Also resolve: exact preamble wording per mode; per-agent delivery (CC hook vs AGENTS.md vs instructions files) — reference how superpowers' SessionStart hook detects harness and emits the right context field. Produce the spec artifact, then the resume prompt.
