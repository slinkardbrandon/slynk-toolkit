#!/usr/bin/env node
/**
 * handoff helper: collects git state, the OS temp dir, and installed skills
 * so the skill can build an accurate handoff document and resume prompt.
 *
 * Usage: node handoff-context.mjs [--repo /path/to/repo]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const now = new Date();
const pad = (number_) => String(number_).padStart(2, "0");
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const result = {
  tmpDir: os.tmpdir(),
  handoffDir: path.join(os.tmpdir(), "slynk", "handoff"),
  date,
  timestamp: `${date}-${time}`,
  git: getGitContext(),
  skills: getInstalledSkills(),
};

console.log(JSON.stringify(result, null, 2));

function getGitContext() {
  const argumentIndex = process.argv.indexOf("--repo");
  const cwd =
    argumentIndex !== -1 && process.argv[argumentIndex + 1]
      ? path.resolve(process.argv[argumentIndex + 1])
      : undefined;

  const options = { encoding: "utf8", cwd, stdio: ["pipe", "pipe", "pipe"] };

  let root;
  try {
    root = execSync("git rev-parse --show-toplevel", options).trim();
  } catch {
    return null;
  }

  const run = (cmd) => {
    try {
      return execSync(cmd, { ...options, cwd: root }).trim();
    } catch {
      return "";
    }
  };

  return {
    root,
    repoName: path.basename(root),
    branch: run("git branch --show-current"),
    lastCommits: run("git log --oneline -10").split("\n").filter(Boolean),
    status: run("git status --short").split("\n").filter(Boolean),
    changedFiles: run("git diff --name-only HEAD").split("\n").filter(Boolean),
  };
}

function getInstalledSkills() {
  // Union skill names across every dir the installer writes to (mirrors
  // lib/installer.mjs resolveRuntimes): Claude, Copilot, Codex (~/.agents),
  // and OpenCode under XDG. Honors the same env overrides so a moved config
  // dir still resolves. Installed skills carry the `slynk-` prefix.
  const home = os.homedir();
  const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  const directories = [
    path.join(process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude"), "skills"),
    path.join(process.env.COPILOT_HOME || path.join(home, ".copilot"), "skills"),
    path.join(home, ".agents", "skills"),
    path.join(process.env.OPENCODE_CONFIG_DIR || path.join(xdg, "opencode"), "skills"),
  ];

  const names = new Set();
  for (const dir of directories) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() || entry.isSymbolicLink()) names.add(entry.name);
      }
    } catch {
      // dir doesn't exist -- skip
    }
  }
  return [...names];
}
