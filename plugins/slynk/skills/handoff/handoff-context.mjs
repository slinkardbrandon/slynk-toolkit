#!/usr/bin/env node
/**
 * handoff helper: collects git state, the OS temp dir, and installed skills
 * so the skill can build an accurate handoff document and resume prompt.
 *
 * Usage: node handoff-context.mjs [--repo /path/to/repo]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const now = new Date();
const pad = (num) => String(num).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const result = {
  tmpDir: os.tmpdir(),
  handoffDir: path.join(os.tmpdir(), 'handoff'),
  date,
  timestamp: `${date}-${time}`,
  git: getGitContext(),
  skills: getInstalledSkills(),
};

console.log(JSON.stringify(result, null, 2));

function getGitContext() {
  const argIdx = process.argv.indexOf('--repo');
  const cwd =
    argIdx !== -1 && process.argv[argIdx + 1]
      ? path.resolve(process.argv[argIdx + 1])
      : undefined;

  const opts = { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'] };

  let root;
  try {
    root = execSync('git rev-parse --show-toplevel', opts).trim();
  } catch {
    return null;
  }

  const run = (cmd) => {
    try {
      return execSync(cmd, { ...opts, cwd: root }).trim();
    } catch {
      return '';
    }
  };

  return {
    root,
    repoName: path.basename(root),
    branch: run('git branch --show-current'),
    lastCommits: run('git log --oneline -10').split('\n').filter(Boolean),
    status: run('git status --short').split('\n').filter(Boolean),
    changedFiles: run('git diff --name-only HEAD').split('\n').filter(Boolean),
  };
}

function getInstalledSkills() {
  // Union skill names across the dirs Claude Code and Copilot CLI discover.
  const dirs = [
    path.join(os.homedir(), '.claude', 'skills'),
    path.join(os.homedir(), '.copilot', 'skills'),
    path.join(os.homedir(), '.agents', 'skills'),
  ];
  const names = new Set();
  for (const dir of dirs) {
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
