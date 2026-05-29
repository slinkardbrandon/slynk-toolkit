Spec out slynk-toolkit's todo-list convention. Independent — parallelizable.

Read first:

- docs/specs/2026-05-29-slynk-roadmap-mechanisms.md

Use the /spec skill.

Goal: get superpowers' on-rails task-list behavior (visible TodoWrite checklists that keep the agent on track) as a lightweight CONVENTION, not new infra.

Key fact: TodoWrite is a built-in Claude Code tool, not something you install. superpowers gets its task-lists by instructing skills to "create a task per checklist item." So this is a shared convention skills reference — no new machinery.

Resolve: where the convention lives (shared reference file? per-skill instruction?); graceful degradation to a markdown checklist on agents without the tool (Copilot/Codex); which skills opt in. Workflow-review steer: scope to skills that already have multi-step checklists (create-pr's 10 steps, spec's phases), and only emit todos when step count crosses ~4+ AND the work is non-trivial — a 10-item list for a 2-file change feels bolted-on. Opt-in, never a mandate. Produce the spec artifact, then the resume prompt.
