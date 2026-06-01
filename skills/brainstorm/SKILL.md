---
name: brainstorm
description: >-
  Diverge on a fuzzy idea BEFORE planning it: shape the fog into 2-3 concrete
  approaches with tradeoffs, recommend a direction, and on your approval
  continue into the slynk-spec skill inline (or hand off a paste-ready seed for a
  fresh session). Use when the moment is unshaped, e.g. "rough idea", "not sure
  how to approach this", "kick around some options", "help me think through X".
  When a question can be answered by inspecting a real source, it offers parallel
  research agents. Not for a single question that has a direct answer -- just
  answer it. Not for stress-testing an existing plan or a direction you've
  already picked (use slynk-spec), and not for capturing a session to continue
  elsewhere (use slynk-handoff).
argument-hint: a rough idea or problem statement (optional)
---

<what-to-do>

Take a fuzzy idea and diverge: explore the space, ask only the questions that
move it forward, produce 2-3 distinct approaches with tradeoffs, and recommend
one. Hold the gate -- no code, no spec handoff until the direction is shaped and
the user approves. On approval, continue into `slynk-spec` inline (default) or
hand off a paste-ready seed.

The divergent front-end to `slynk-spec`:

```
vague idea -> brainstorm (diverge, shape, pick) -> spec (harden) -> implement -> create-pr
```

Brainstorm turns fog into a candidate direction; spec hardens a direction into a
plan. Already have a direction, or a plan to pressure-test? That's `slynk-spec`,
not this.

</what-to-do>

<supporting-info>

## Inputs

```
/brainstorm                       -- describe the rough idea next turn
/brainstorm "should we cache X?"  -- inline problem statement
```

No issue-fetch path -- brainstorm starts from fog, not a ticket.

## Phase 0 -- Load context

One helper call:

```bash
node "{{SLYNK_DIR}}/brainstorm-sources.mjs"
```

> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir. If the command
> isn't found, the toolkit isn't installed -- run `npx slynk-toolkit`.

Returns one JSON blob:

- **`context`** -- repo, convention files, CONTEXT.md glossary, recent specs,
  package scripts (reused from spec's helper). `null` outside a repo --
  brainstorm still works, just less grounded.
- **`sources`** -- what's reachable here: `git` (repo? host?), `gh`/`glab`
  (authed?), `mcp` (server names on disk). Gates fan-out targets (Phase 2a).

Read the glossary -- challenge new terms against it, offer to capture genuinely
new ones at the end.

**Capabilities (for fan-out):** `sources` says what's reachable; your tool list
says what you can do. Only you can see whether you have a subagent/Task primitive
(required to fan out) and web tools (required for web targets). Gate on observed
tools, not runtime brand. No subagent primitive -> use the static table below.

| Runtime            | Subagent primitive     | Fan-out mode          |
| ------------------ | ---------------------- | --------------------- |
| Claude Code        | Task tool + background | background-while-work |
| GitHub Copilot CLI | agent mechanism        | launch-and-await      |
| OpenCode           | none confirmed         | inline / await        |
| Codex              | none confirmed         | inline / await        |
| VS Code Copilot    | unverified             | inline / await        |

(Source: `docs/runtime-support.md`; static fallback, not a probe.)

**Track the flow** loosely (clarify -> fan-out -> approaches -> gate -> hand off):

- Mirror it in a task-list tool where you have one, else a markdown checklist.
- Keep it light -- the shape shifts as the idea does, so don't lock into a rigid plan.
- This is brainstorm's own soft tracking, not the toolkit's todo-list convention (which
  is for linear, static flows).

## Phase 1 -- Silent framing

Frame internally first; don't dump it on the user:

- Restate the core decision in one sentence.
- Sketch 2-3 genuinely different solution shapes (differ in approach, not detail).
- Split open questions: ones only the user can answer (preference/intent) vs ones
  a reachable source can (-> Phase 2a candidates).
- If `context` exists, ground against repo patterns, recent specs, and glossary
  terms the idea touches.

## Phase 2 -- Progressive clarifying

Ask the questions that move fog to shape, each with your recommended answer where
you have one.

- Batch only independent questions (answering one doesn't change another); ask
  interdependent ones in sequence.
- Don't ask what `context` answers -- state it. Challenge ambiguous terms against
  the glossary.
- Keep it short -- a few roundtrips, not an interrogation.

### Phase 2a -- Research fan-out (offer, never auto-fire)

When a roundtrip raises a **research angle** -- an open question a reachable
source can answer (codebase/tickets/web), not the user's preference -- offer
parallel research agents. Offer only when:

- A real research angle exists (never for user-only questions).
- You can name a **specific target**: a path/glob, a named ticket query, a
  specific web query -- not a topic.
- It's reachable: codebase if in a repo; tickets if `gh`/`glab` is authed or
  `sources.mcp` lists a server covering the target type (jira/github/linear/...);
  web if you have web tools (your own tool list -- `sources` can't see those).
- At most once per roundtrip (one user reply). Silent when nothing's
  researchable. Don't re-offer after a decline unless a new source becomes
  reachable -- not just a reworded query.

Offer (firm, not shouty -- they opted in):

```
A few of these I can check directly instead of guessing. Want me to dispatch:
  - codebase: `src/cache/**` -- how is invalidation handled today?
  - web: "Redis vs in-memory LRU eviction tradeoffs 2025"
Say which to run, or skip.
```

Dispatch only after the offer is accepted (never on idea-approval, never on a
guess):

- **Background-while-work** where supported (keep the Q&A going, fold findings in
  as they land); **launch-and-await** otherwise; no primitive -> research inline
  yourself, or skip and say so.
- Force distilled output -- claim + source, never raw dumps:

```
Investigate <specific target + scope>. Return ONLY findings, each as:
<one-line claim> -- <source: file:line / URL / ticket id>. No file or page dumps.
If nothing relevant, say so in one line.
```

Findings land in the seed's Research findings (Phase 5) and feed spec's grilling.

## Phase 3 -- Diverge: approaches

Produce **2-3 distinct** approaches (different in shape, not wording), as a table:

```
| Approach  | How it works (1 line) | Tradeoffs     |
| --------- | --------------------- | ------------- |
| A. <name> | ...                   | + ... / - ... |
```

Draw a mermaid/ASCII diagram inline when flow is clearer drawn than described. If
only one approach is genuinely viable, say so and why the others were rejected --
never fabricate filler to hit a count.

## Phase 4 -- Recommend & shape

Name a direction and why, in one line:

```
Recommendation: B, because <the decisive tradeoff>.
```

Ask for approval:

> Does B look right, or should we reshape?

- **Go with it** -> approved, Phase 5.
- **Different approach** -> pick A/C or a hybrid; re-present.
- **Reshape** -> back to Phase 2/3.

## The gate

No code, no spec handoff until all three hold:

1. 2-3 approaches with tradeoffs presented.
2. A direction recommended.
3. The user **explicitly approves** it.

"Shaped" = 1+2; "approved" = 3 -- a shaped direction the user hasn't okayed is
not approved. The user may collapse the gate ("just build B", "skip to spec");
**you may never collapse it yourself.** Mirrors spec's "just start implementing."

## Phase 5 -- Hand off to spec

First, does the work even warrant a spec? If it's small and obvious (a couple of
files, no open architectural calls), say so and offer to just implement it (or
stop). Otherwise offer two paths -- default to continuing here:

> Direction approved. Spec it out now, or take the seed to a fresh session?

### 5a -- Spec it now (default)

Continue into `slynk-spec` in this session -- that exact name (the toolkit's spec
skill always installs as `slynk-spec`; don't grab a lookalike like a plain `spec`
or `review-spec`). Invoke it via your runtime's skill mechanism (the Skill tool
on Claude Code, by-description elsewhere); if you can't invoke it directly, fall
back to 5b. The shaped direction, approaches, findings, and terms are already in
the conversation -- carry them as its input so it doesn't re-ask: the approaches
and findings feed its grilling and Key Decisions rationale, so don't drop them.
`slynk-spec` owns the plan and its artifact; don't write those yourself.

### 5b -- Take the seed (fresh session)

For a clean context, a later session, or another machine. Emit a paste-ready
prompt -- the seed IS `slynk-spec`'s inline description, so spec needs no code
change. No invocation line in the block (the user invokes `slynk-spec`
themselves; how varies by runtime). Mirrors spec's resume prompt / handoff.

```
Spec this out -- poke holes and produce an implementation plan. Here's the shaped
direction from a brainstorming session:

## Chosen direction
<direction> -- <one-line why>

## Approaches considered
| Option | Tradeoffs | Why not |
| ------ | --------- | ------- |
| A. ... | ...       | ...     |
| B. ... | ...       | chosen  |

## Research findings
- <claim> -- <source>          (omit if none)

## New terms for CONTEXT.md
- **<term>**: <gloss>          (omit if none)
```

Then:

> Paste into a fresh session and invoke `slynk-spec`. It carries the direction,
> rejected options, and findings; `slynk-spec` hardens it into a plan.

## Phase 6 -- Not proceeding

If the user stops before approving, don't force the gate or emit a seed. Recap in
<= 5 one-line bullets (problem, approaches floated, where it stalled), then offer
any glossary captures:

> Terms worth capturing in CONTEXT.md: <term> -- <gloss>. Add them?

Persist nothing else.

## Rules (every reply)

- **Opt-in, never a pre-gate.** Fire on a fuzzy moment; never front-run a clear request.
- **Firm, not shouty.** Hold the gate and force real approaches; drop the MUST/1% tone.
- **Derive, don't invent.** Approaches, findings, and terms come from real sources and the conversation.
- **Own one thing.** Brainstorm diverges and shapes; `slynk-spec` hardens, `slynk-handoff` captures.
- **Cross-agent.** This file + the one helper load everywhere; fan-out degrades where there's no subagent primitive; text-only always works.
- **Skimmable.** Comparisons as tables, diagrams as mermaid/ASCII, summaries <= 7 one-line bullets, no prose block over 3 sentences.

</supporting-info>
