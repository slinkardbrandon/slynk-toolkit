# slynk-toolkit

Reusable, cross-agent engineering skills driven by one `SKILL.md` per skill.
Lightweight by default, dialable up -- adopts useful mechanisms without forced ceremony.

## Language

**Mechanism**:
Reusable plumbing a skill or the toolkit provides -- bootstrap hook, task-list convention,
subagent fanout. slynk adopts mechanisms.
_Avoid_: conflating with "ceremony."

**Ceremony**:
Mandatory process layered on skills -- forced gates, required artifacts, must-invoke rules.
slynk rejects forced ceremony as a default.
_Avoid_: "superpowers-style" to mean both mechanism and ceremony at once.

**Bootstrap mode**:
The `suggest | force | off` setting controlling how strongly the session-start preamble pushes
skill discovery. `suggest` = lightweight nudge (default); `force` = the 1%/MUST language.
_Avoid_: "the hook" -- the Claude Code SessionStart hook is only the delivery layer, not the mode.

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

**Sentinel token** (`{{SLYNK_DIR}}`):
A placeholder in a source `SKILL.md` that the installer expands to the skill's absolute install
dir, so the skill calls its sibling helper without a PATH lookup. Copy install resolves it to the
destination dir; `--link` to the source clone. The standard way every helper-bearing skill finds
its scripts.
_Avoid_: `${CLAUDE_PLUGIN_ROOT}` / "the plugin root" -- that dual-path model is retired.
