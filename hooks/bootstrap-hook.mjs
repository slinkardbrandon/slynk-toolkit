#!/usr/bin/env node
// slynk bootstrap session hook (Claude Code SessionStart).
//
// Emits one aggressive skill-router nudge as SessionStart context, listing only
// the slynk-* skills actually installed. Dependency-free, location-independent,
// fail-open: any error exits 0 with no output so it never blocks a session.
//
// Lives at <claude-config>/slynk/bootstrap-hook.mjs (copy mode) or the clone's
// hooks/ dir (link mode). Either way it resolves the Claude skills dir itself --
// never from cwd. The AGENTS.md block (other runtimes) is the installer's static
// twin of this message; keep the two route lists in sync if you edit either.

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "slynk-";

// Curated trigger -> skill routes. A row is emitted only if its skill is
// installed (availability gating). Order is the workflow order.
const ROUTES = [
  { skill: "brainstorm", when: "fuzzy/unshaped idea" },
  { skill: "spec", when: "ready to build something non-trivial" },
  { skill: "create-pr", when: "changes ready to ship" },
  { skill: "handoff", when: "wrapping up or low on context" },
];

function hasSlynkSkill(skillsDir) {
  try {
    return readdirSync(skillsDir).some((entry) => entry.startsWith(PREFIX));
  } catch {
    return false;
  }
}

// Copy mode: skills sit at <config>/skills, a sibling of this script's <config>/slynk.
// Link mode: this script runs from the clone, so fall back to the Claude config dir.
function resolveSkillsDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const sibling = join(here, "..", "skills");
  if (hasSlynkSkill(sibling)) return sibling;
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  return join(configDir, "skills");
}

function installedRoutes(skillsDir) {
  let entries;
  try {
    entries = new Set(readdirSync(skillsDir));
  } catch {
    return [];
  }
  return ROUTES.filter((route) => entries.has(PREFIX + route.skill));
}

function buildNudge(routes) {
  const table = routes.map((route) => `${route.when} -> ${PREFIX}${route.skill}`).join("; ");
  return (
    "slynk skills are installed. Route the user's intent to a skill instead of doing the work " +
    `ad-hoc -- they encode how this user works: ${table}. Reach for these proactively; when a ` +
    "moment plausibly fits, invoke rather than ask."
  );
}

function main() {
  const routes = installedRoutes(resolveSkillsDir());
  if (routes.length === 0) return; // zero slynk skills -> emit nothing
  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: buildNudge(routes),
    },
  };
  process.stdout.write(JSON.stringify(output));
}

try {
  main();
} catch {
  // Fail open: never block session start, never spam stderr.
}
process.exit(0);
