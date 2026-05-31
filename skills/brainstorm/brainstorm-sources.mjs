#!/usr/bin/env node
/**
 * brainstorm helper: Phase-0 context + reachable-source probe in one shot.
 *
 * Emits a JSON blob the skill reads once at the start of a session:
 *   {
 *     context: <spec-context.mjs output, or null>,   // repo, conventions, CONTEXT.md glossary, recent specs
 *     sources: { git, gh, glab, mcp }                 // what research sources are reachable in THIS env
 *   }
 *
 * Two concerns, deliberately split:
 *   - `context` is reused wholesale from the sibling spec skill's helper
 *     (spec-context.mjs) -- no re-derivation. We resolve the sibling at runtime
 *     because its install dir differs by mode: `skills/spec` in a dev --link
 *     clone, `slynk-spec` in a copy install. A hardcoded relative path in
 *     SKILL.md can't be right for both; doing it here in JS can.
 *   - `sources` is deterministic CLI/filesystem detection, mirroring create-pr's
 *     Step 0 (git host, gh/glab auth). It reports only what's reachable by
 *     inspecting the machine. It does NOT claim to know the agent's own tools
 *     (web search, a subagent/Task primitive, runtime-injected MCP tools) --
 *     those are runtime capabilities the agent self-assesses from its tool list,
 *     not facts on disk. The SKILL.md gates fan-out on that, plus this probe.
 *
 * Usage: node brainstorm-sources.mjs [--repo /path/to/repo]
 * Dependency-free. Resolves its own paths. Never throws -- unreachable sources
 * report `false`/`null` so the skill degrades to text-only cleanly.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Resolve --repo once so context AND the source probes describe the same repo.
// Without it, context would describe the given repo while git/mcp probes
// described the shell's cwd -- the skill could then misjudge the host or MCP set.
const REPO_PATH = parseRepoPath();

const result = {
  context: gatherContext(),
  sources: probeSources(REPO_PATH),
};

console.log(JSON.stringify(result, null, 2));

function parseRepoPath() {
  const flag = process.argv.indexOf("--repo");
  if (flag !== -1 && process.argv[flag + 1]) return path.resolve(process.argv[flag + 1]);
  return null;
}

// --- context (delegated to the sibling spec helper) ---

// Run spec-context.mjs as a subprocess and return its parsed JSON. Returns null
// if the sibling can't be found or it isn't a git repo -- brainstorm still works
// with reduced context.
function gatherContext() {
  const helper = findSpecContextHelper();
  if (!helper) return null;

  const args = [helper];
  if (REPO_PATH) args.push("--repo", REPO_PATH);

  try {
    const out = execFileSync(process.execPath, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return JSON.parse(out);
  } catch {
    // not in a repo (spec-context exits 1) or unreadable output
    return null;
  }
}

// The spec skill is a sibling. Its dir is `spec` in a dev clone (--link mode) and
// `slynk-<name>` in a copy install. Try both; first hit wins.
function findSpecContextHelper() {
  for (const sibling of ["spec", "slynk-spec"]) {
    const candidate = path.join(HERE, "..", sibling, "spec-context.mjs");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// --- sources (deterministic CLI/filesystem probe) ---

function probeSources(repoCwd) {
  return {
    git: probeGit(repoCwd),
    gh: probeCli("gh", ["auth", "status"]),
    glab: probeCli("glab", ["auth", "status"]),
    mcp: probeMcp(repoCwd),
  };
}

// In a repo? What host does origin point at? Classifies github/gitlab/other so
// the skill knows whether ticket/PR queries are even on the right platform.
function probeGit(repoCwd) {
  const inRepo = run("git rev-parse --is-inside-work-tree", { cwd: repoCwd }) === "true";
  if (!inRepo) return { inRepo: false, remoteHost: null, remoteUrl: null };

  const remoteUrl = run("git remote get-url origin", { cwd: repoCwd });
  return { inRepo: true, remoteHost: classifyHost(remoteUrl), remoteUrl: remoteUrl || null };
}

function classifyHost(url) {
  if (!url) return null;
  if (url.includes("github.com") || /github\./i.test(url)) return "github";
  if (/gitlab/i.test(url)) return "gitlab";
  return "other";
}

// Is the CLI installed, and is it authenticated? Auth check is what gates
// whether issue/PR fan-out targets are actually reachable. execFileSync (no
// shell) keeps this injection-proof if the args ever stop being literals.
function probeCli(bin, args) {
  try {
    execFileSync(bin, ["--version"], { stdio: "ignore" });
  } catch {
    return { installed: false, authed: false };
  }
  // auth status exits non-zero when not logged in; treat any throw as unauthed.
  try {
    execFileSync(bin, args, { stdio: "ignore" });
    return { installed: true, authed: true };
  } catch {
    return { installed: true, authed: false };
  }
}

// Best-effort, honest MCP detection: file-based config only. Runtime-injected
// MCP tools are invisible here -- the agent sees those in its own tool list.
// Reports the server names found in any project-level config so the skill can
// spot a jira/confluence/github MCP without claiming to know the live tool set.
function probeMcp(repoCwd) {
  const root = repoCwd || run("git rev-parse --show-toplevel") || process.cwd();
  const candidates = [
    path.join(root, ".mcp.json"),
    path.join(root, ".vscode", "mcp.json"),
    path.join(root, ".cursor", "mcp.json"),
  ];

  const configs = [];
  const servers = new Set();
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    configs.push(path.relative(root, file));
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      // Server map is an object keyed by name. Guard against an array or scalar
      // slipping through -- Object.keys on those yields indices, not names.
      const block = asPlainObject(parsed.mcpServers) || asPlainObject(parsed.servers) || {};
      for (const name of Object.keys(block)) servers.add(name);
    } catch {
      // malformed config -- record the file, skip its servers
    }
  }
  return { configs, servers: [...servers] };
}

// A non-null, non-array object, or null. Used to validate parsed JSON shapes.
function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// --- shared exec wrapper ---

// Run a git command, return trimmed stdout or null on any failure. stderr is
// swallowed so a not-a-repo error never leaks into output. These commands embed
// no caller data, so a shell string is safe; CLI probes use execFileSync.
function run(command, { cwd } = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      ...(cwd ? { cwd } : {}),
    }).trim();
  } catch {
    return null;
  }
}
