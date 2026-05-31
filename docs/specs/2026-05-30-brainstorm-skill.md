<!--
  Created with spec
  Author: Brandon Slinkard <slinkardbrandon@gmail.com>
-->

# /brainstorm (Divergent Ideation Front-End)

> Spec session -- 2026-05-30
> Net-new skill. No issue yet.
> Parent: docs/specs/2026-05-29-slynk-roadmap-mechanisms.md (Tier 1, brainstorm entry)

## Summary

The divergent front-end to `/spec`. Pipeline: vague idea -> `/brainstorm` (diverge, shape, pick a
direction) -> `/spec` (harden into a plan) -> implement -> `/create-pr`. Firm discipline lives inside
the skill; the global nudge lives in the bootstrap router (#3). Opt-in, never a pre-gate. When a
question raises a research angle, it offers parallel research agents whose distilled findings seed `/spec`.

## Key Decisions

- **Divergent front-end, not a second spec.** Brainstorm turns fog into a candidate direction; `/spec` hardens a direction into a plan. Disjoint triggers keep them apart.
- **Triggers (pinned).** Brainstorm fires on fuzzy-idea phrasing: "rough idea", "not sure how to approach", "kick around some options", "help me think through". Its description carries a reciprocal pointer ("not for stress-testing an existing plan -- use /spec"), and `/spec`'s description gains the inverse ("not for a fuzzy/unshaped idea -- use brainstorm"). The seam is bidirectional.
- **Two-layer ceremony.** Firm discipline inside the skill; the global "reach for this" nudge lives in the bootstrap router (#3), never here.
- **The gate (explicit exit criteria).** Write no code and do not invoke `/spec` until ALL hold: (1) 2-3 approaches with tradeoffs presented, (2) a recommended direction named, (3) the user explicitly approves that direction. "Shaped" = (1)+(2); "approved" = (3).
  - **User-override ramp.** The user may deliberately collapse the gate ("just build option B", "skip to spec"); the agent may never collapse it on its own. Mirrors `/spec`'s "just start implementing."
- **Approaches: at least 2, ideally 3.** Each with tradeoffs + a recommendation. If only one is genuinely viable, say so and why alternatives were rejected -- never fabricate filler (derive, don't invent).
- **No durable doc; default to continuing into `/spec` inline, seed is the hop fallback.** _(Amended 2026-05-30 during build.)_ On approval, offer two paths, default to continuing in-session: **(a) spec it now** -- continue into the spec skill in the same conversation, carrying the shaped direction/approaches/findings as its input so context isn't thrown away on a hop; **(b) take the seed** -- emit an inline, paste-ready prompt (mirrors `/spec` 5b and `/handoff`) that a fresh `/spec` consumes as its inline description, for a clean context / later / another machine. Either way **`/spec` needs no code change** and nothing is written to disk. Rationale: the paste-hop discards the context brainstorm just built; inline continuation keeps it. Offer, don't auto-fire (mirrors the gate + fan-out stance); only push a spec when the work warrants one.
  - **Seed template (fixed sections):** `## Chosen direction` (direction + one-line why); `## Approaches considered` (table: option | tradeoffs | why not); `## Research findings` (claim + source bullets, if any); `## New terms for CONTEXT.md` (term + gloss, if any).
  - **Where the non-plan parts land in `/spec`:** "Approaches considered" and "Research findings" feed `/spec`'s Phase 2 grilling and its Key Decisions rationale -- not silently dropped.
- **Research fan-out (v1, inline).** When a question raises a research angle, offer parallel research subagents.
  - **A research angle** = an open question answerable by inspecting a reachable source (codebase / tickets / web), not by the user's preference or intent. Never offer fan-out for questions only the user can answer.
  - **Offer, never auto-fire.** Targets emerge as the Q&A unfolds; auto-firing burns agents on blind guesses. Launch (background or await) only after the user accepts the fan-out offer itself, not on approval of the idea.
  - **Cadence:** at most one offer per roundtrip (one assistant reply, regardless of how many questions it batched). If the user declines, do not re-offer unless a materially different source becomes reachable. A "new research need" = a target no prior offer covered. Stay silent on roundtrips that raise nothing researchable.
  - **Specific targets only.** Each target names a concrete source + scope (a path/glob, a named ticket query, a specific web query), not a topic. A topic-only question isn't ready for fan-out.
  - **Distilled return.** The dispatch prompt forces claim + source, never raw file/page dumps. Findings land in the seed's Research findings section; the primary runner stays lean.
  - **Tone:** firm and concrete trigger, not shouty -- the user already opted in.
  - **Inline now, extract later.** Lives in this SKILL.md; lift to a shared mechanism only when a second consumer (`/spec`, `pr-review`) needs it. Write the dispatch + distill block self-contained so extraction is a copy. Future `.slynk.yml brainstorm.fanout: offer | auto | off` dial; `offer` is default.
- **Capability gating by tool presence, not runtime brand.** An agent can't reliably know "am I Copilot?" Gate on observable tools: is a subagent/Task primitive available? are web tools present? is a Jira/Confluence/GitHub MCP or CLI configured? The per-runtime primitive (CC background Task, Copilot's mechanism, Codex/OpenCode TBD) is a static table sourced from `docs/runtime-support.md`, not a runtime probe. Text-only brainstorm works everywhere.
- **Helpers (amends the earlier no-helper v1 call).** Reuse `spec-context.mjs` for Phase-0 context (repo root, CONTEXT.md glossary, recent specs) rather than re-derive in prose. Add a small dependency-free `brainstorm-sources.mjs` that probes reachable research sources (gh/glab auth, MCP config, git remote host, web tools) -- deterministic detection mirroring `create-pr`'s Step 0. The fan-out primitive stays a static matrix, not a probe.
- **Visual = mermaid + ASCII inline, no browser server.** Renders everywhere, version-controlled, skims fast. superpowers' websocket/HTML companion is heavy and UI-design-only -- dropped.
- **Progressive cadence, batched only when independent.** Batch questions together only when their answers are independent (answering one doesn't change whether or how you'd ask another). Ask interdependent questions sequentially so each answer steers the next. A "cluster" = one such batch.
- **Skimmable output (hard rule).** Comparisons as tables; diagrams as mermaid/ascii; summary <= 7 one-line bullets; no prose block over 3 sentences.
- **Cross-agent first.** Prose-only SKILL.md plus the two helpers; loads on Claude / Copilot / Codex / OpenCode. On runtimes with no subagent primitive (Codex/OpenCode today), fan-out degrades to inline research or launch-and-await; text-only is unaffected.

## Terms Clarified

- **Seed**: the paste-ready prompt brainstorm emits on approval, consumed by a fresh `/spec` as its inline description. Fixed sections (chosen direction, approaches considered, research findings, new terms). Not durable, not written to disk.
- **The gate**: the in-skill rule blocking code/spec-handoff until shaped (2-3 approaches + named direction) and approved (explicit user yes). The user may collapse it deliberately; the agent may not.
  _Avoid_: superpowers' universal `<HARD-GATE>` ("every project regardless of simplicity").
- **Research angle**: an open question answerable by inspecting a reachable source, not by user preference. The fan-out firing condition.
- **Inline summary**: a brief recap shown only if the user stops before approval. Not the seed, not structured, not persisted -- but it still offers any CONTEXT.md term captures so they aren't lost.
- **Research fan-out**: dispatching parallel research subagents (inline in this SKILL.md) that return claim + source. Brainstorm is the first consumer.

## Test Cases

Behavioral / discoverability checks, proportional to a prose skill.

- Trigger discrimination: a fuzzy prompt fires `/brainstorm`; an existing plan fires `/spec`; a session capture fires `/handoff`. Descriptions are disjoint with bidirectional pointers.
- Gate criteria: brainstorm writes no code and doesn't invoke `/spec` until 2-3 approaches are shown, a direction is recommended, and the user explicitly approves. A user "just build it" collapses the gate; the agent never does on its own.
- Approaches: presents >=2 (ideally 3) with tradeoffs + a recommendation; if only one is viable, says so without fabricating alternatives.
- Handoff: on approval, defaults to continuing into `/spec` inline (carrying the shaped direction/approaches/findings as its input); the paste-ready seed (fixed sections) is the fallback for a fresh session. Either way `/spec` needs no code change; approaches + findings surface in `/spec`'s grilling/decisions, not dropped.
- Fan-out offer: only on a roundtrip with a research angle; names specific targets; lists only sources `brainstorm-sources.mjs` reports reachable; at most once per roundtrip; doesn't re-offer after a decline unless a new source becomes reachable; silent when nothing is researchable.
- Fan-out ordering: agents launch only after the fan-out offer is accepted (not on idea-approval); dispatched agents return claim + source, not raw dumps.
- Capability gating: fan-out is offered iff a subagent primitive is observably present; on a no-primitive runtime it degrades to inline/await and brainstorm still works text-only.
- Not-proceeding: if the user stops before approval, brainstorm shows a capped inline summary and offers any new CONTEXT.md terms; persists nothing.
- Skimmable form: comparisons are tables; diagrams mermaid/ascii; summary <= 7 one-line bullets.
- Cross-agent: frontmatter `name` matches dir after install; SKILL.md loads with no Claude-only dependency.

## Implementation Plan

### Approach

1. Author `skills/brainstorm/SKILL.md` (top-level `skills/`).
2. Process: reuse `spec-context.mjs` for context -> progressive clarifying questions (batch only independent ones) -> per-roundtrip fan-out offer when a research angle appears -> 2-3 approaches + recommendation -> present shaped direction -> gate (explicit criteria + user-override) -> hand off to `/spec` (inline continuation by default; paste-ready seed as the fresh-session fallback).
3. Add `brainstorm-sources.mjs` (reachable-source probe) and a static runtime-primitive table (from runtime-support.md) for capability gating.
4. Write the fan-out dispatch + distill block self-contained (claim + source; launch only after offer accepted; specific targets) for easy later extraction.
5. Pin the description triggers + bidirectional pointers; add the inverse pointer to `/spec`'s description.
6. Bake the hard rules: gate criteria, skimmable form, opt-in framing, firm-not-shouty tone.
7. Docs: add `/brainstorm` to README; add a fan-out capability-tier row to runtime-support.md; link the roadmap item to this spec.

### Files to touch

- `skills/brainstorm/SKILL.md` -- new skill.
- `skills/brainstorm/brainstorm-sources.mjs` -- new dependency-free probe for reachable research sources (gh/glab auth, MCP config, git remote host, web tools). Mirrors create-pr Step 0 detection.
- Reuse `skills/spec/spec-context.mjs` for Phase-0 context (it's a sibling skill's helper -- relative-path it from the brainstorm install dir, or add a thin re-export; decide at build).
- `skills/spec/SKILL.md` -- add the inverse description pointer (not optional) + a one-line note that `/spec` can be seeded by an upstream `/brainstorm` (seed arrives as the inline description, no parsing needed).
- `README.md` -- add `/brainstorm` to the skill list.
- `docs/runtime-support.md` -- add `/brainstorm` and a fan-out capability tier (background / await / text-only) per runtime.
- `docs/specs/2026-05-29-slynk-roadmap-mechanisms.md` -- mark the brainstorm item specced; link this spec.

### Patterns to follow

- Skill voice from spec/handoff/create-pr: prose, no AI-isms, no em-dashes, scannable.
- Bidirectional disjoint-description pointers (spec/handoff already do this).
- Question-with-recommendation from `/spec`, but progressive.
- Source/platform detection from `create-pr` Step 0 (gh/glab/MCP) -> `brainstorm-sources.mjs`.
- Paste-ready prompt format shared with `/spec` 5b and `/handoff`.
- Installer handles `slynk-` prefix + frontmatter `name` rewrite; source `name: brainstorm`.

### How to verify

- Dry-run a fuzzy prompt: diverges (>=2 approaches), holds the gate on explicit criteria, and on approval offers inline `/spec` continuation (default) or a paste-ready seed; take the seed path, paste it into `/spec`, and confirm it runs with no `/spec` change.
- Dry-run a fuzzy + research-y prompt on Claude Code and Copilot: fan-out offered with specific targets, launched only after accept, runs in background while Q&A continues, distilled findings land in the seed.
- Confirm `brainstorm-sources.mjs` reports only actually-reachable sources (toggle gh auth / a fake MCP) and the offer reflects it.
- Confirm a no-primitive runtime (or simulated) degrades to inline/await and text-only still works.
- Trigger discrimination (plan -> /spec; capture -> /handoff); valid frontmatter; `node --check` on the new helper.

### Assumptions

- Depends on the bootstrap router (#3) for auto-suggest delivery; works standalone when invoked directly.
- **todo-convention dependency (roadmap):** brainstorm uses the todo-list convention for its multi-step flow (clarify -> fan-out -> approaches -> gate -> seed) where the runtime supports it; degrades to a markdown checklist otherwise. If the convention isn't built yet, brainstorm ships with inline step tracking and adopts it when it lands.
- Research fan-out is inline (no shared mechanism yet -- YAGNI); the dispatch + distill block is written for clean later extraction.
- Codex/OpenCode fan-out primitives are TBD; fan-out degrades to inline/await there for v1, text-only unaffected.
