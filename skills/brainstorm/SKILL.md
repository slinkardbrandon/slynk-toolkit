---
name: brainstorm
description: >-
  Diverge on a fuzzy idea BEFORE planning it: shape the fog into 2-3 concrete
  approaches with tradeoffs, recommend a direction, and on your approval
  continue into the slynk-spec skill inline (or hand off a paste-ready seed for
  a fresh session). Use when the moment is
  unshaped, e.g. "rough idea", "not sure how to approach this", "kick around
  some options", "help me think through X". When a question can be answered by
  inspecting a real source, it offers parallel research agents. Not for a single
  question that has a direct answer -- just answer it. Not for stress-testing an
  existing plan or a direction you've already picked (use slynk-spec), and not
  for capturing a session to continue elsewhere (use slynk-handoff).
argument-hint: a rough idea or problem statement (optional)
---

<what-to-do>

Take a fuzzy idea and diverge: explore the space, ask only the questions that
move it forward, and produce 2-3 concrete approaches with tradeoffs and a
recommendation. Hold the gate -- write no code and don't hand off to `/spec`
until the direction is shaped and the user approves it. On approval, continue
into spec inline (default), or hand off a paste-ready seed for a fresh session.

This is the divergent front-end to `/spec`. The pipeline:

```
vague idea -> /brainstorm (diverge, shape, pick) -> /spec (harden into a plan)
           -> implement -> /create-pr
```

`/brainstorm` turns fog into a candidate direction; `/spec` hardens a direction
into a plan. If the user already has a direction or a plan to pressure-test,
that's `/spec`, not this.

</what-to-do>

<supporting-info>

## Inputs

```
/brainstorm                          -- describe the rough idea in the next turn
/brainstorm "should we cache X?"     -- inline problem statement
```

No issue-fetch path: brainstorm starts from fog, not a written ticket. If the
user has a ticket, they want `/spec`.

---

## Phase 0 -- Load Context

Gather everything available before engaging. One helper call:

```bash
node "{{SLYNK_DIR}}/brainstorm-sources.mjs"
```

> `{{SLYNK_DIR}}` is expanded by the installer to this skill's absolute install
> dir, so the helper runs by absolute path -- no PATH lookup. If the command
> isn't found, the toolkit isn't installed: run `npx slynk-toolkit` (or
> `npm run install:local` from a clone).

It returns one JSON blob with two keys:

- **`context`** -- repo root, name, default branch; convention files (CLAUDE.md,
  CONTEXT.md, etc.); the CONTEXT.md glossary; recent spec artifacts; package
  scripts. This is the sibling `/spec` helper's output, reused wholesale. It is
  `null` when you're not in a git repo -- brainstorm still works (it shapes
  ideas, it isn't codebase-bound), just with less grounding.
- **`sources`** -- what research sources are reachable in THIS environment:
  `git` (in a repo? remote host github/gitlab/other?), `gh`/`glab` (installed
  and authenticated?), `mcp` (project-level MCP server names found on disk).
  This gates which fan-out targets you may offer (Phase 2a).

Read the CONTEXT.md glossary if present -- you'll challenge new terms against it
and offer to capture genuinely new ones at the end.

### 0a -- Self-assess capabilities (for fan-out)

`sources` tells you what's reachable; your own tool list tells you what you can
do with it. Two things only you can observe (the helper can't):

- **Subagent primitive** -- do you have a Task/subagent tool, or a way to launch
  parallel agents? Required to offer research fan-out.
- **Web tools** -- do you have web search/fetch? Required to offer web targets.

Gate on observable tool presence, never on guessing your runtime brand. If you
can't see a subagent primitive, fall back to the static table below; if that
runtime has none, fan-out degrades to inline research or launch-and-await, and
brainstorm still works text-only.

| Runtime     | Subagent primitive     | Fan-out mode          |
| ----------- | ---------------------- | --------------------- |
| Claude Code | Task tool + background | background-while-work |
| Copilot     | agent mechanism        | launch-and-await      |
| OpenCode    | none confirmed         | inline / await        |
| Codex       | none confirmed         | inline / await        |

(Source: `docs/runtime-support.md`. The table is a static fallback, not a probe
-- prefer what you actually observe in your tool list.)

### 0b -- Track the multi-step flow

Use the todo-list convention if your runtime supports it: one task per step
(clarify -> fan-out -> approaches -> gate -> hand off). Where the tool is absent,
keep an inline markdown checklist. Either way the user can see where you are.

---

## Phase 1 -- Silent Framing

Before engaging, build a quick internal frame. Don't dump this on the user.

- **Restate the core problem** in one sentence. What is actually being decided?
- **Surface the solution space.** What are the genuinely different shapes a
  solution could take? Look for 2-3 that differ in approach, not in detail.
- **Note the open questions** that block shaping -- separate the ones only the
  user can answer (preference, intent, priorities) from the ones a reachable
  source could answer (these become fan-out candidates in Phase 2a).
- If `context` is present, ground against the repo: existing patterns, prior
  art in recent specs, terms in the glossary that the idea touches.

---

## Phase 2 -- Progressive Clarifying

Ask the questions that move the idea from fog to shape. Each question carries
your recommended answer where you have one -- a "yes" or a push-back is faster
than open-ended.

**Cadence -- progressive, not one big dump:**

- **Batch only independent questions.** Two questions go in the same batch only
  if answering one doesn't change whether or how you'd ask the other.
- **Ask interdependent questions sequentially** so each answer steers the next.
- A "cluster" is one such batch. Keep it short -- target a few total roundtrips,
  not an interrogation.

**Rules for questions:**

- Don't ask what `context` already answers. State what you found instead.
- Challenge ambiguous terms, including against the CONTEXT.md glossary.
- Separate preference questions (only the user can answer) from researchable
  ones (a reachable source can answer) -- the latter feed Phase 2a, not a
  question to the user.

### Phase 2a -- Research Fan-Out (offer, never auto-fire)

When a roundtrip raises a **research angle** -- an open question answerable by
inspecting a reachable source (codebase / tickets / web), not by the user's
preference or intent -- offer to dispatch parallel research agents.

**When to offer:**

- **A real research angle exists.** Never offer fan-out for questions only the
  user can answer.
- **Specific targets only.** Each target names a concrete source + scope: a
  path or glob, a named ticket query, a specific web query. A topic-only
  question ("how does auth work generally") isn't ready -- narrow it first.
- **Reachable in this env.** Offer a target only if `sources` (Phase 0) reports
  it reachable: codebase always (in a repo); tickets only if `gh`/`glab` is
  authed or a matching MCP server is configured; web only if you have web tools.
- **At most one offer per roundtrip** (one assistant reply, however many
  questions it batched). Stay silent on roundtrips that raise nothing
  researchable.
- **Don't re-offer after a decline** unless a new research need arises -- a
  target no prior offer covered (it can surface from the Q&A on an
  already-reachable source, not only from a newly-reachable one).

**The offer** -- firm and concrete, not shouty (the user already opted into
brainstorm). Name the targets and what each would answer:

```
A few of these I can check directly instead of guessing. Want me to dispatch:
  - codebase: `src/cache/**` -- how is invalidation handled today?
  - web: "Redis vs in-memory LRU eviction tradeoffs 2025"
Say which to run, or skip.
```

**Dispatch (only after the offer is accepted):**

- Launch agents only once the user accepts the fan-out offer itself -- not on
  approval of the idea, and never on a blind guess. Targets emerge as the Q&A
  unfolds; auto-firing burns agents.
- **Background-while-work** where the runtime supports it (continue the
  synchronous Q&A; fold findings in as they land). **Launch-and-await** as the
  fallback. No primitive at all -> read the target sources yourself with the
  file/bash tools you do have; if even those are absent, skip and say so.
- **The dispatch prompt forces distilled output: claim + source, never raw file
  or page dumps.** Each agent returns a short list of `claim -- source` lines.
  This keeps the primary runner lean -- raw dumps defeat the whole point.

Dispatch prompt shape (per agent):

```
Investigate <specific target + scope>. Return ONLY a short list of findings,
each as: <one-line claim> -- <source: file:line / URL / ticket id>. No raw file
contents, no page dumps. If you find nothing relevant, say so in one line.
```

Findings land in the seed's `## Research findings` section (Phase 5) and feed
`/spec`'s grilling and Key Decisions. They are not dropped.

---

## Phase 3 -- Diverge: Approaches

Produce **at least 2, ideally 3** distinct approaches. Distinct means different
in shape, not different in wording.

Present them as a table -- comparisons are always tables here:

```
| Approach        | How it works (1 line) | Tradeoffs                  |
| --------------- | --------------------- | -------------------------- |
| A. <name>       | ...                   | + ... / - ...              |
| B. <name>       | ...                   | + ... / - ...              |
| C. <name>       | ...                   | + ... / - ...              |
```

Use a mermaid or ASCII diagram inline when structure or flow is clearer drawn
than described. No browser server, no external renderer -- diagrams render in
the terminal and version-control cleanly.

**Derive, don't invent.** If only one approach is genuinely viable, say so and
explain why the alternatives were rejected. Never fabricate filler options to
hit a count.

---

## Phase 4 -- Recommend & Shape

Name a recommended direction and say why in one line. This is the "shaped"
state: 2-3 approaches presented + a direction recommended.

```
Recommendation: B, because <one-line why -- the decisive tradeoff>.
```

Then ask for approval explicitly:

> Does B look like the right direction, or should we reshape?

Choices:

- **Go with the recommendation** -- (approved -> Phase 5, hand off to spec)
- **Different approach** -- pick A/C, or describe a hybrid (reshape, re-present)
- **Reshape** -- the framing is off; what's missing? (back to Phase 2/3)

---

## The Gate

Write no code and do not invoke `/spec` until **all three** hold:

1. 2-3 approaches with tradeoffs are presented (Phase 3).
2. A recommended direction is named (Phase 4).
3. The user **explicitly approves** that direction.

"Shaped" = (1) + (2). "Approved" = (3). Don't conflate them -- a shaped
direction the user hasn't said yes to is not approved.

**User-override ramp.** The user may deliberately collapse the gate ("just build
option B", "skip to spec", "I've seen enough"). Honor it. **The agent may never
collapse the gate on its own** -- no skipping ahead to code or `/spec` because
the direction "seems obvious." This mirrors `/spec`'s "just start implementing"
ramp: the user can short-circuit; you can't.

This is firm discipline inside the skill, not a universal mandate. The "reach
for brainstorm" nudge lives in the bootstrap router, never here. Don't gate
every fuzzy thought regardless of size -- gate this session, once it's running.

---

## Phase 5 -- Hand Off to Spec

On approval the shaped direction is ready to harden into a plan. **Nothing is
written to disk.** Offer two paths -- default to continuing here:

> Direction approved. Want me to spec it out now, or take the seed to a fresh
> session?

- **Spec it now** (recommended) -- continue into `slynk-spec` in this session.
- **Take the seed to a fresh session** -- emit the paste-ready seed (5b).

First judge whether the work even warrants a spec: if the approved direction is
small and obvious, say so and offer to just implement it (or stop) rather than
pushing a spec it doesn't need.

### 5a -- Spec it now (inline, default)

Continue into `slynk-spec` in the same session. Use that exact installed name --
the toolkit's spec skill is always installed as `slynk-spec`. Don't hand off to a
similarly-named skill (a plain `spec`, `review-spec`, etc.) that may also be
present. The shaped direction, approaches, findings, and any new terms are
already in this conversation -- carry them as its input so it doesn't re-ask what
brainstorm already settled. Lay out the shaped direction (the 5b sections) as the
framing, then run its process: its exploration and grilling sharpen the chosen
direction, and the approaches and findings feed its Key Decisions rationale.
Brainstorm hands off here -- `slynk-spec` owns the plan and its artifact; don't
write that yourself.

### 5b -- Take the seed to a fresh session

For a clean context, a later session, or another machine. Emit a paste-ready
prompt -- the seed IS `slynk-spec`'s inline description, so spec needs no code
change. The seed block stays a plain description (no invocation line) because
each runtime invokes skills differently -- a slash on Claude Code, by-description
elsewhere -- so the user invokes `slynk-spec` themselves and pastes this as its
input. Mirrors how `slynk-spec` 5b and `slynk-handoff` emit resume prompts.

```
Spec this out -- poke holes and produce an implementation plan. Here's the
shaped direction from a brainstorming session:

## Chosen direction
<direction> -- <one-line why>

## Approaches considered
| Option | Tradeoffs | Why not |
| ------ | --------- | ------- |
| A. ... | ...       | ...     |
| B. ... | ...       | chosen  |

## Research findings
- <claim> -- <source>          (omit the section if none)

## New terms for CONTEXT.md
- **<term>**: <gloss>          (omit the section if none)
```

Keep sections that carry signal; omit `Research findings` / `New terms` when
empty. Then a one-line pointer:

> Paste that into a fresh session and invoke `slynk-spec`. It reads as a spec
> request and carries the direction, the rejected options, and any findings;
> `slynk-spec` hardens it into a plan.

---

## Phase 6 -- Not Proceeding (stopped before approval)

If the user stops before approving a direction, don't force the gate and don't
emit a seed. Show a **capped inline summary** -- not the seed, not structured,
not persisted:

- Recap in <= 5 one-line bullets: the problem, the approaches floated, where it
  stalled.

Then, so nothing is lost, offer any CONTEXT.md term captures you noticed:

> I noticed these terms worth capturing in CONTEXT.md: <term> -- <gloss>. Want
> me to add them?

Persist nothing else. The session can resume later from the recap.

---

## Skimmable Output (hard rules)

These hold for every reply in the session:

- Comparisons are **tables**, never prose paragraphs.
- Diagrams are **mermaid or ASCII**, inline.
- The shaped summary is **<= 7 one-line bullets**.
- **No prose block over 3 sentences.** If it's longer, it's a list or a table.

---

## Behavioral Rules

1. **Opt-in, never a pre-gate.** Brainstorm fires when the moment is fuzzy. It
   must never auto-front-run all work or insert itself before a clear request.
2. **Firm, not shouty.** Hold the gate and force real approaches, but drop the
   1%/MUST tone. Directive is not the same as loud.
3. **Derive, don't invent.** Approaches, findings, and terms come from real
   sources and the actual conversation -- never fabricated to fill a section.
4. **Each skill owns one thing.** Brainstorm diverges and shapes. It does not
   harden plans (that's `/spec`) or capture sessions (that's `/handoff`).
5. **Cross-agent first.** This SKILL.md plus the one helper load everywhere.
   On a runtime with no subagent primitive, fan-out degrades; text-only is
   unaffected.

</supporting-info>
