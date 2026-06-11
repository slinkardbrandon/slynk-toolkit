# slynk-toolkit

Reusable, cross-agent engineering skills driven by one `SKILL.md` per skill.
Lightweight by default, dialable up -- adopts useful mechanisms without forced ceremony.

## Language

**Mechanism**:
Reusable plumbing a skill or the toolkit provides -- bootstrap hook, todo-list convention,
subagent fanout. slynk adopts mechanisms.
_Avoid_: conflating with "ceremony."

**Ceremony**:
Mandatory process layered on skills -- forced gates, required artifacts, must-invoke rules.
slynk rejects forced ceremony as a default.
_Avoid_: "superpowers-style" to mean both mechanism and ceremony at once.

**Bootstrap nudge**:
The single hardcoded skill-router text injected at session start, auto-installed into every detected
agent (CC SessionStart hook; a slim `AGENTS.md` block elsewhere). One aggressive variant -- no
suggest/force/off modes (the dial was dropped). Adjust by editing the source and reinstalling.
_Avoid_: "bootstrap mode" / "the dial" -- that design is retired.

**Mindset lens**:
A short reference skill (e.g. `/tdd`) that shapes _how to think_ about a task during planning --
invoked to influence a decision, not to execute work.
_Avoid_: "the TDD skill" implying an executor that writes or runs tests.

**Work classification**:
The category `/spec` assigns to incoming work: bug | feature | chore/config | ticket-only.
Drives conditional behavior -- e.g. bug/feature pulls in the `/tdd` lens; chore/ticket-only skips it.

**Skill**:
A single folder with one `SKILL.md` (+ optional dependency-free `.mjs` helpers). The unit of
distribution. Works identically across supported agents.
_Avoid_: "command" -- these are skills, not slash-only commands, though agents may surface them as both.

**Seed** (`/brainstorm`):
The structured brainstorm output `/spec` consumes as input. On approval brainstorm defaults to
continuing into `/spec` inline; the seed is the paste-ready fallback for a fresh session. Fixed
sections: chosen direction, approaches considered, research findings, new terms. Not durable, never
written to disk.
_Avoid_: "the spec" -- the seed is `/spec`'s input, not its output.

**The gate** (`/brainstorm`):
The in-skill rule blocking code or `/spec` handoff until the idea is shaped (2-3 approaches + a
named direction) and approved (explicit user yes). The user may collapse it deliberately; the agent
may not.
_Avoid_: a universal `<HARD-GATE>` mandate on every task -- the gate is scoped to a running
brainstorm session, not forced ceremony.

**Research angle**:
An open question answerable by inspecting a reachable source (codebase / tickets / web), not by the
user's preference or intent. The firing condition for research fan-out.
_Avoid_: a topic -- an angle names a concrete source + scope, not a subject area.

**Research fan-out**:
Dispatching parallel research subagents that burn their own context and return distilled, cited
findings (claim + source), keeping the primary runner lean. Capability-gated by observable tool
presence. `/brainstorm` is the first consumer; inline for now, extractable later.
_Avoid_: "subagent fanout" alone -- the load-bearing part is the distilled, cited return.

**Todo-list convention**:
The shared instruction a linear, static multi-step skill (`slynk-spec`, `slynk-create-pr`) carries:
mirror your own flow as native task-list items -- one per step, updated as you go -- to stay on-rails.
Capability-gated on the runtime's task-list tool (whatever it's named -- CC `TaskCreate`, OpenCode
`todowrite`, Codex `update_plan`; Copilot CLI has none); degrades to a re-posted markdown checklist
where none exists. Emits only on non-trivial 4+ step runs. Tracks the skill's process, not the work
it plans.
_Avoid_: naming a specific tool in a `SKILL.md` -- names differ per runtime and drift per version, so
gate on capability. _Avoid_: forcing it on divergent skills (`/brainstorm`) -- it's for static flows.

**Sentinel token** (`{{SLYNK_DIR}}`):
A placeholder in a source `SKILL.md` that the installer expands to the skill's absolute install
dir, so the skill calls its sibling helper without a PATH lookup. Copy install resolves it to the
destination dir; `--link` to the source clone. The standard way every helper-bearing skill finds
its scripts.
_Avoid_: `${CLAUDE_PLUGIN_ROOT}` / "the plugin root" -- that dual-path model is retired.

**Shared lib**:
A `skills/slynk-*/` dir with no `SKILL.md` -- a helper module skills import via a relative
`../slynk-<name>/file.mjs`. The installer copies it verbatim (never prefixed, rendered, routed, or
listed as a skill); the relative import resolves against the importing helper's own dir in both
install modes. The `slynk-` name lets uninstall's prefix sweep clean it and prevents clobbering a
user dir.
_Avoid_: calling it a "skill" -- it has no `SKILL.md` and never loads as one.

**Buildability gate** (`/spec`):
The QC step at `slynk-spec`'s tail: after writing the spec draft to disk, fan out reviewers over it
and withhold the resume prompt until it passes (can a cold agent build this?). Hard for the agent,
collapsible by an explicit user override -- mirrors brainstorm's gate.
_Avoid_: "spec approval" -- it judges artifact buildability, not whether the design fits intent.

**Lens flavor** (`/spec-review`):
An optional, open-ended emphasis passed to `slynk-spec-review` (security, cross-platform, design,
...) that biases a single review pass on top of the baseline rubric. The caller assigns distinct
flavors across fanned reviewers for perspective-diverse coverage.
_Avoid_: a fixed lens enum -- flavors derive from the work being reviewed.

**Teaching workspace** (`/teach`):
The directory `slynk-teach` runs in: MISSION.md (the marker file), RESOURCES.md, lessons/,
learning-records/, reference/, GLOSSARY.md, NOTES.md. All teaching state lives there as files so
any future session resumes cold. No MISSION.md = not a workspace; the skill offers to scaffold.
_Avoid_: "the lesson folder" -- the workspace is the whole stateful unit, not one subdir.

**Learning record** (`/teach`):
The teaching workspace's ADR: a numbered note of real signal about the learner (passed retrieval,
prior knowledge, corrected misconception, mission shift). Written stingily, superseded never
deleted; the records compute where to pitch the next lesson.
_Avoid_: writing one for mere exposure -- reading a lesson is not evidence.

**Mechanical check** (`/write-skill`):
The deterministic lint `skill-check.mjs` runs over a skill folder (frontmatter shape, description
doctrine, echo-pipes, helper imports, sentinel use). The script-checkable floor; judgment lenses
belong to `slynk-skill-review`, which folds this output in rather than re-deriving it.
_Avoid_: "the review" -- the check is mechanical, the review is judgment.

**Skill-review verdict** (`/skill-review`):
`slynk-skill-review`'s structured return -- `PASS`/`BLOCKED` plus severity-grouped, lens-tagged
findings on shippability (routes? loads cross-agent? runs without guessing?). The contract
`slynk-write-skill`'s review gate aggregates. Mirrors the spec-review verdict.
_Avoid_: conflating with the mechanical check -- the verdict subsumes it.

**Spec-review verdict** (`/spec-review`):
`slynk-spec-review`'s structured return -- `PASS`/`BLOCKED` plus severity-grouped, lens-tagged
findings. The contract a caller aggregates to gate. `slynk-spec-review` judges artifact quality;
the machine-local `review-spec` judges intent-fit -- different skills, do not conflate.
_Avoid_: "spec review passed" as a single-reviewer claim -- a gate verdict aggregates several.
