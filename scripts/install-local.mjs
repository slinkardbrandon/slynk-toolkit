#!/usr/bin/env node
// Local dev installer. Symlinks each slynk skill into every AI-agent skills dir
// found on this machine, so live edits in the clone reflect immediately.
//
// Usage:
//   node scripts/install-local.mjs            symlink (default) into detected agents
//   node scripts/install-local.mjs --copy     copy instead of symlink
//   node scripts/install-local.mjs --uninstall remove slynk- entries from detected agents
//
// Detection is path-based with env overrides. A runtime is "present" only if its
// config dir already exists — we don't create agent homes that aren't there.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  lstatSync,
  cpSync,
  symlinkSync,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const PREFIX = "slynk-"; // namespaced so we never clobber a user's own skills
const args = new Set(process.argv.slice(2));
const MODE = resolveMode();
function resolveMode() {
  if (args.has("--uninstall")) return "uninstall";
  if (args.has("--copy")) return "copy";
  return "symlink";
}

// Skills + bin shims live under plugins/slynk relative to this script's root.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const SKILLS_SRC = join(REPO_ROOT, "plugins", "slynk", "skills");
const BIN_SRC = join(REPO_ROOT, "plugins", "slynk", "bin");
// Where to put the helper shims on PATH. Honors npm's prefix if set, else ~/.local/bin.
const BIN_DEST = join(process.env.npm_config_prefix || join(HOME, ".local"), "bin");

// Per-runtime skills dir, honoring env overrides. xdg-aware where the agent is.
const XDG = process.env.XDG_CONFIG_HOME || join(HOME, ".config");
const RUNTIMES = [
  { id: "claude", skills: join(process.env.CLAUDE_CONFIG_DIR || join(HOME, ".claude"), "skills") },
  {
    id: "copilot",
    skills: join(process.env.COPILOT_CONFIG_DIR || join(HOME, ".copilot"), "skills"),
  },
  { id: "codex", skills: join(process.env.CODEX_HOME || join(HOME, ".codex"), "skills") },
  {
    id: "opencode",
    skills: join(process.env.OPENCODE_CONFIG_DIR || join(XDG, "opencode"), "skills"),
  },
];

function detectRuntimes() {
  // Present if the agent's parent config dir exists (skills/ may not yet).
  return RUNTIMES.filter((r) => existsSync(dirname(r.skills)));
}

function listSkills() {
  return readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function removeExisting(target) {
  if (existsSync(target) || isBrokenLink(target)) rmSync(target, { recursive: true, force: true });
}

function isBrokenLink(p) {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

// Past-tense verb for the current mode, used in status output.
function modeVerb() {
  if (MODE === "uninstall") return "removed from";
  if (MODE === "copy") return "copied to";
  return "linked into";
}

function linkOne(sourceDir, target) {
  removeExisting(target);
  if (MODE === "copy") cpSync(sourceDir, target, { recursive: true });
  else symlinkSync(sourceDir, target, "dir");
}

function linkBinShims() {
  // The helper shims are invoked by bare name from SKILL.md, so they must be on
  // PATH. npx/npm bin-links these automatically; locally we symlink them ourselves.
  if (!existsSync(BIN_SRC)) return;
  const shims = readdirSync(BIN_SRC, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".mjs"))
    .map((d) => d.name);
  if (shims.length === 0) return;
  mkdirSync(BIN_DEST, { recursive: true });
  for (const file of shims) {
    const cmd = file.replace(/\.mjs$/, ""); // slynk-spec-context.mjs → slynk-spec-context
    const target = join(BIN_DEST, cmd);
    if (MODE === "uninstall") {
      removeExisting(target);
    } else {
      removeExisting(target);
      if (MODE === "copy") cpSync(join(BIN_SRC, file), target);
      else symlinkSync(join(BIN_SRC, file), target, "file");
    }
  }
  console.log(`shims     ${modeVerb()} ${BIN_DEST}`);
  if (MODE !== "uninstall" && !pathHas(BIN_DEST)) {
    console.warn(`\n⚠  ${BIN_DEST} is not on your PATH -- the helper commands won't resolve.`);
    console.warn(`   Add it:  export PATH="${BIN_DEST}:$PATH"`);
  }
}

function pathHas(dir) {
  const real = (() => {
    try {
      return realpathSync(dir);
    } catch {
      return dir;
    }
  })();
  return (process.env.PATH || "").split(":").some((p) => {
    try {
      return realpathSync(p) === real;
    } catch {
      return p === dir;
    }
  });
}

function run() {
  if (!existsSync(SKILLS_SRC)) {
    console.error(`No skills found at ${SKILLS_SRC}`);
    process.exit(1);
  }
  const runtimes = detectRuntimes();
  if (runtimes.length === 0) {
    console.error("No supported AI-agent config dirs found on this machine.");
    console.error("Looked for: " + RUNTIMES.map((r) => dirname(r.skills)).join(", "));
    process.exit(1);
  }
  const skills = listSkills();
  for (const rt of runtimes) {
    mkdirSync(rt.skills, { recursive: true });
    for (const name of skills) {
      const target = join(rt.skills, PREFIX + name);
      if (MODE === "uninstall") {
        removeExisting(target);
      } else {
        linkOne(join(SKILLS_SRC, name), target);
      }
    }
    console.log(`${rt.id.padEnd(9)} ${modeVerb()} ${rt.skills}`);
  }
  linkBinShims();
  const action = { uninstall: "Uninstalled", copy: "Copied", symlink: "Linked" }[MODE];
  console.log(
    `\n${action} ${skills.length} skill(s) across ${runtimes.length} runtime(s): ${skills.map((s) => PREFIX + s).join(", ")}`,
  );
  if (MODE === "symlink")
    console.log(
      "Symlinked -- edits in this clone are live. Reload skills in your agent to pick them up.",
    );
}

run();
