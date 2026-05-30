---
name: handoff
description: 'Reach for this INSTEAD of /compact when you want to keep the current session intact: it captures the session into a standalone doc plus a paste-ready prompt so a fresh agent continues cold, while this session stays untouched. Covers code work (branch, uncommitted, changed files) and planning work (tickets, docs, diagrams, discussion). Use when the user says "hand this off", "spin this off", "write this up for a fresh agent", "continue this later", "save where we are", or is running low on context. Not for pressure-testing a plan before building new work; use the spec skill for that.'
---

# Create Handoff Document

This is NOT `/compact` -- compact compresses the current session in place and
loses the original; this writes a SEPARATE document so the session you're in
stays intact while a fresh agent starts cold from it. Reach for it once you've
built up handoff-worthy context (tickets, a design, a diagram, parallel edits)
and want to spin off the next piece without squashing what you're doing.

## Step 1 -- Gather Context

Run the helper to collect git state and the OS temp dir:

```bash
node "{{SLYNK_DIR}}/handoff-context.mjs"
```

> `{{SLYNK_DIR}}` is expanded by the installer to this skill's absolute install
> dir, so the helper runs by absolute path -- no PATH lookup. If the command
> isn't found, the toolkit isn't installed: run `npx slynk-toolkit` (or
> `npm run install:local` from a clone).

`git` is null when you're not in a repo, and it may carry no signal for a pure
planning session -- that's expected. See the shapes in Step 2.

## Step 2 -- Pick the shape

Decide what dominated the session:

- **Code handoff** -- you were editing code, often in parallel. The git state
  matters: branch, what's uncommitted, what changed.
- **Planning handoff** -- tickets, docs, diagrams, or pure discussion. There may
  be little or no git state; the substance lives in the conversation itself.

Most sessions are clearly one. If genuinely mixed, lead with whichever the next
agent needs most and fold the other in.

## Step 3 -- Build the Document

Write for an AI agent that has NO prior context. Short declarative sentences.
State facts and next actions, no hedging.

**Reference, don't duplicate -- except what only exists here.** If something is
already captured in an artifact (PR, commit, committed doc, issue, diagram
file), reference it by path or URL. But when the substance lives ONLY in this
conversation -- a plan we talked through, ticket drafts, a diagram sketched in
prose, decisions with no paper trail -- **capture it in the doc**. That is the
whole point: the fresh agent cannot see the conversation.

Redact API keys, passwords, tokens, and PII. Replace with `[REDACTED]`.

If the user passed arguments, treat them as what the next session will focus on
and tailor the doc accordingly.

### Format

Include the sections that carry signal; omit the rest.

```markdown
# Handoff: <short topic>

> Session: YYYY-MM-DD
> Code: <repo> · <branch> or Planning: <tickets / docs / diagram / discussion>

## Summary

<2-3 sentences: what got done, what's left, why this handoff exists>

## Where Things Stand

Code handoff:

- **Branch:** `<branch>` · **Working tree:** <clean / N uncommitted> · **Last commit:** `<SHA>` <msg>
- <what's done vs. mid-flight across the parallel threads>

Planning handoff:

- **Done / drafted:** <what's fully worked out -- tickets specced, sections written, decisions locked>
- **Pending:** <what's still open -- stubs, unanswered questions, untouched parts>
- **Where it lands:** <where the outputs go -- issue tracker, doc path, etc.>

## Key Decisions

- <Decision -- one sentence + rationale. Reference an artifact if the detail lives elsewhere>

## Artifacts

- <PR / commit / doc path / issue / diagram file -- only those that exist>

## Open Questions

- <Unresolved item -- what needs deciding and the context>

(Omit if none.)

## Suggested Skills

- `<skill-name>` -- one-line rationale

(List skills relevant to the next session from those available to you this
session -- use your own awareness of loaded skills, including plugin skills
named `plugin:skill`. Omit the section if none apply.)

## Next Steps

1. <First thing>
2. <Second thing>

Start by reading: <this handoff, plus any artifact to open first>
```

## Step 4 -- Save

Generate a short topic slug from the session (2-4 words, kebab-case, no special
chars). Write to `{handoffDir}/handoff-{date}-{topic}.md`, where `{handoffDir}`
is the value the helper returned in Step 1 (the OS temp dir + `slynk/handoff`).
Create that directory if it doesn't exist.

## Step 5 -- Emit the resume prompt

This is the primary output. Present a short, paste-ready prompt in the terminal
that the user drops into a FRESH session. The fresh agent has no prior context,
so the prompt sends it to the doc -- which you wrote to be self-sufficient.

```
You're picking up work cold -- no prior context. Read this first; it's written
to get you started from scratch:

  {absolute path to the saved handoff}

It has the background, decisions, and next steps. Begin with step 1.
```

If the user passed focus arguments, append one line naming that focus.

Then, as a convenience, show the clipboard one-liner for their platform:

```
cat <path> | clip.exe                # WSL
cat <path> | pbcopy                  # macOS
cat <path> | xclip -selection clip   # Linux/X11 (or: xsel -b)
cat <path> | wl-copy                 # Linux/Wayland
```

(Pick whichever clipboard tool is installed -- `xclip`/`xsel` on X11,
`wl-copy` on Wayland.)
