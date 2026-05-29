---
name: handoff
description: 'Capture the current conversation into a standalone handoff document and emit a paste-ready prompt so a fresh agent can continue cold — for code or planning work (tickets, docs, diagrams, discussion). Use when the user wants to hand off, spin off, or pass along work, or says things like "let''s hand this off", "write this up for a fresh agent", or "I''ll continue this elsewhere". Prefer over /compact when keeping the current session intact.'
argument-hint: What will the next session be used for?
---

# Create Handoff Document

This is NOT `/compact`. Compact compresses the current session in place and you
lose the original. This writes a SEPARATE document so the session you're in
stays intact, while a fresh agent starts cold from the document. Reach for it
when you've built up handoff-worthy context — a batch of tickets, a design, a
diagram, parallel code edits — and want to spin off the next piece without
squashing what you're doing.

## Step 1 — Gather Context

Run the helper to collect git state and the OS temp dir:

```bash
slynk-handoff-context
```

> This is a PATH command installed alongside the skills (via `npx` bin-linking
> or the local installer). Works the same on Claude Code, Copilot CLI, and
> Codex — no path or env var to set. If not found, run `npm run install:local`
> from the clone, or fall back to `node <skill-dir>/handoff-context.mjs`.

`git` is null when you're not in a repo, and it may carry no signal for a pure
planning session — that's expected. See the shapes in Step 2.

## Step 2 — Pick the shape

Decide what dominated the session:

- **Code handoff** — you were editing code, often in parallel. The git state
  matters: branch, what's uncommitted, what changed.
- **Planning handoff** — tickets, docs, diagrams, or pure discussion. There may
  be little or no git state; the substance lives in the conversation itself.

Most sessions are clearly one. If genuinely mixed, lead with whichever the next
agent needs most and fold the other in.

## Step 3 — Build the Document

Write for an AI agent that has NO prior context. Short declarative sentences.
State facts and next actions, no hedging.

**Reference, don't duplicate — except what only exists here.** If something is
already captured in an artifact (PR, commit, committed doc, issue, diagram
file), reference it by path or URL. But when the substance lives ONLY in this
conversation — a plan we talked through, ticket drafts, a diagram sketched in
prose, decisions with no paper trail — **capture it in the doc**. That is the
whole point: the fresh agent cannot see the conversation.

Redact API keys, passwords, tokens, and PII. Replace with `[REDACTED]`.

If the user passed arguments, treat them as what the next session will focus on
and tailor the doc accordingly.

### Format

Include the sections that carry signal; omit the rest.

```markdown
# Handoff: <short topic>

> Session: YYYY-MM-DD
> Code: <repo> · <branch> —or— Planning: <tickets / docs / diagram / discussion>

## Summary

<2-3 sentences: what got done, what's left, why this handoff exists>

## Where Things Stand

Code handoff:

- **Branch:** `<branch>` · **Working tree:** <clean / N uncommitted> · **Last commit:** `<SHA>` <msg>
- <what's done vs. mid-flight across the parallel threads>

Planning handoff:

- **Done / drafted:** <what's fully worked out — tickets specced, sections written, decisions locked>
- **Pending:** <what's still open — stubs, unanswered questions, untouched parts>
- **Where it lands:** <where the outputs go — issue tracker, doc path, etc.>

## Key Decisions

- <Decision — one sentence + rationale. Reference an artifact if the detail lives elsewhere>

## Artifacts

- <PR / commit / doc path / issue / diagram file — only those that exist>

## Open Questions

- <Unresolved item — what needs deciding and the context>

(Omit if none.)

## Suggested Skills

- `<skill-name>` — one-line rationale

(List skills relevant to the next session from those available to you this
session — use your own awareness of loaded skills, including plugin skills
named `plugin:skill`. Omit the section if none apply.)

## Next Steps

1. <First thing>
2. <Second thing>

Start by reading: <this handoff, plus any artifact to open first>
```

## Step 4 — Save

Generate a short topic slug from the session (2-4 words, kebab-case, no special
chars). Write to `{tmpDir}/handoff/handoff-{date}-{topic}.md`. Create the
`handoff` directory if it doesn't exist.

## Step 5 — Emit the resume prompt

This is the primary output. Present a short, paste-ready prompt in the terminal
that the user drops into a FRESH session. The fresh agent has no prior context,
so the prompt sends it to the doc — which you wrote to be self-sufficient.

```
You're picking up work cold — no prior context. Read this first; it's written
to get you started from scratch:

  {absolute path to the saved handoff}

It has the background, decisions, and next steps. Begin with step 1.
```

If the user passed focus arguments, append one line naming that focus.

Then, as a convenience, show the clipboard one-liner for their platform:

```
cat <path> | clip.exe     # WSL
cat <path> | pbcopy       # macOS
cat <path> | xclip        # Linux
```
