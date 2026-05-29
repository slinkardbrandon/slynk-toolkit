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
  // Union skill names across everywhere Claude Code and Copilot CLI discover
  // skills: the standalone skill dirs, plus every installed Claude Code plugin
  // (whose skills live under the plugin's installPath/skills, NOT in the
  // standalone dirs — so a plugin-only install would otherwise show nothing).
  const directories = [
    path.join(os.homedir(), ".claude", "skills"),
    path.join(os.homedir(), ".copilot", "skills"),
    path.join(os.homedir(), ".agents", "skills"),
  ];

  // Enumerate plugin-installed skills from the install manifest. Reading
  // installPath is more robust than globbing the cache (handles non-default
  // scopes/versions). Shape: { plugins: { "name@market": [ { installPath } ] } }
  const manifest = path.join(os.homedir(), ".claude", "plugins", "installed_plugins.json");
  try {
    const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
    for (const installs of Object.values(data.plugins ?? {})) {
      for (const inst of installs ?? []) {
        if (inst?.installPath) directories.push(path.join(inst.installPath, "skills"));
      }
    }
  } catch {
    // no plugins manifest — skip
  }

  const names = new Set();
  for (const dir of directories) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() || entry.isSymbolicLink()) names.add(entry.name);
      }
    } catch {
      // dir doesn't exist — skip
    }
  }
  return [...names];
}
