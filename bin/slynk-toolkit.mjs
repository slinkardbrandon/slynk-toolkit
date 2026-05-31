#!/usr/bin/env node
// slynk-toolkit installer CLI. Thin wrapper over lib/installer.mjs: parse flags,
// resolve the shipped skills/ dir and the detected runtimes, delegate to the
// core, print a short status. No PATH/shim logic -- helper paths are templated
// absolute at install time (see lib/installer.mjs renderSkill).
//
// Usage:
//   npx slynk-toolkit              copy skills into every detected agent (default)
//   npx slynk-toolkit --link       dev install from a clone: SKILL.md points back
//                                  at the clone so helper edits stay live
//   npx slynk-toolkit --uninstall  remove slynk-* skills from every detected agent
//   npx slynk-toolkit --help

import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

import { install, uninstall, resolveRuntimes, listSkills, PREFIX } from "../lib/installer.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_SOURCE = join(HERE, "..", "skills");
const HOOK_SOURCE = join(HERE, "..", "hooks", "bootstrap-hook.mjs");

const flags = new Set(process.argv.slice(2));

if (flags.has("--help") || flags.has("-h")) {
  printHelp();
  process.exit(0);
}

// Reject anything we don't recognize, so a typo like `--uninstal` errors out
// instead of silently falling through to a real install.
const KNOWN_FLAGS = new Set(["--copy", "--link", "--uninstall", "--help", "-h"]);
const unknown = [...flags].filter((flag) => !KNOWN_FLAGS.has(flag));
if (unknown.length > 0) {
  console.error(`Unknown option(s): ${unknown.join(", ")}`);
  console.error("Run `npx slynk-toolkit --help` for usage.");
  process.exit(1);
}

const runtimes = resolveRuntimes({ home: homedir(), env: process.env });
if (runtimes.length === 0) {
  console.error("No supported AI-agent config dirs found on this machine.");
  console.error("Looked for: ~/.claude, ~/.copilot, ~/.agents (Codex), ~/.config/opencode.");
  console.error(
    "Create your agent's config dir first (e.g. run the agent once), or set its config-dir env var,",
  );
  console.error("then re-run. Overrides: CLAUDE_CONFIG_DIR, COPILOT_HOME, OPENCODE_CONFIG_DIR.");
  process.exit(1);
}

const mode = await resolveMode();
run(mode);

// --- mode resolution ---

async function resolveMode() {
  if (flags.has("--uninstall")) return "uninstall";
  if (flags.has("--link")) return "link";
  if (flags.has("--copy")) return "copy";
  // No mode flag: prompt on an interactive terminal, else default to copy.
  if (process.stdin.isTTY && process.stdout.isTTY) return promptMode();
  return "copy";
}

async function promptMode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const reply = await rl.question("Install mode -- [c]opy (default) or [l]ink for dev? ");
    const answer = reply.trim().toLowerCase();
    if (answer === "l" || answer === "link") return "link";
    return "copy";
  } finally {
    rl.close();
  }
}

// --- run ---

function run(selectedMode) {
  const labels = listSkills(SKILLS_SOURCE).map((name) => PREFIX + name);

  if (selectedMode === "uninstall") {
    const result = uninstall({ runtimes });
    for (const rt of runtimes) console.log(`${rt.id.padEnd(9)} cleaned  ${rt.skills}`);
    console.log(
      `\nRemoved ${result.removed} slynk-* skill(s) and the bootstrap nudge across ` +
        `${runtimes.length} runtime(s).`,
    );
    return;
  }

  const { nudge } = install({
    skillsSource: SKILLS_SOURCE,
    runtimes,
    mode: selectedMode,
    hookSource: HOOK_SOURCE,
  });
  const verb = selectedMode === "link" ? "linked into" : "copied to";
  for (const rt of runtimes) {
    const flag = rt.experimental ? "  (experimental)" : "";
    console.log(`${rt.id.padEnd(9)} ${verb} ${rt.skills}${flag}`);
  }

  // Per-runtime bootstrap status: CC hook installed/skipped, others' AGENTS.md block.
  const nudgeLabel = {
    hook: "SessionStart hook ->",
    agents: "AGENTS.md nudge   ->",
    skipped: "hook skipped (unparseable settings.json) ->",
  };
  for (const entry of nudge) {
    console.log(`${entry.id.padEnd(9)} ${nudgeLabel[entry.kind]} ${entry.target}`);
  }
  if (nudge.some((entry) => entry.kind === "skipped")) {
    console.log(
      "\nClaude hook skipped: settings.json did not parse. Add a SessionStart command running\n" +
        '`node "<config>/slynk/bootstrap-hook.mjs"` by hand, or fix the JSON and re-run.',
    );
  }

  console.log(
    `\n${selectedMode === "link" ? "Linked" : "Installed"} ${labels.length} skill(s) across ` +
      `${runtimes.length} runtime(s): ${labels.join(", ")}`,
  );
  if (selectedMode === "link") {
    console.log(
      "Dev install: helper edits in the clone are live; SKILL.md edits need a re-run of this command.",
    );
  }
  if (runtimes.some((rt) => rt.experimental)) {
    console.log(
      "Codex support is experimental -- skills load from ~/.agents/skills, but helper exec under its sandbox is unverified.",
    );
  }
  console.log("Reload skills in your agent to pick them up.");
}

function printHelp() {
  console.log(`slynk-toolkit -- install cross-agent skills

Usage:
  npx slynk-toolkit              copy skills into every detected agent (default)
  npx slynk-toolkit --copy       same as the default: copy skills in
  npx slynk-toolkit --link       dev install from a clone (live helper edits)
  npx slynk-toolkit --uninstall  remove slynk-* skills from every detected agent
  npx slynk-toolkit --help

Detected agents: Claude (~/.claude), Copilot (~/.copilot), Codex (~/.agents,
experimental), OpenCode (~/.config/opencode). A runtime is targeted only if its
config dir already exists. Env overrides: CLAUDE_CONFIG_DIR, COPILOT_HOME,
OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME.`);
}
