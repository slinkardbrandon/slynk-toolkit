#!/usr/bin/env node
/**
 * teach helper: Phase-0 workspace probe (and optional scaffold) in one shot.
 *
 * Emits a JSON blob the skill reads once at the start of a session:
 *   {
 *     root, exists,                      // MISSION.md is the workspace marker
 *     mission, resources, notes, glossary,  // file contents, null when absent
 *     lessons:  [{ number, slug, file }],
 *     records:  [{ number, slug, file, status, preview }],
 *     reference: ["cheat-sheet.html", ...],
 *     next: { lesson, record },          // next free artifact numbers
 *     scaffolded: ["MISSION.md", ...]    // only with --scaffold
 *   }
 *
 * One call replaces a dozen reads/globs the agent would otherwise burn turns
 * on. Record contents are previewed, not dumped -- the agent reads the few it
 * needs for the zone-of-proximal-development call.
 *
 * Usage: node teach-workspace.mjs [--workspace /path] [--scaffold]
 * Dependency-free. Never throws -- a missing workspace reports `exists: false`
 * so the skill can offer to scaffold instead of crashing.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = resolveRoot(args);
const scaffold = args.includes("--scaffold");

const scaffolded = scaffold ? scaffoldWorkspace(root) : [];
console.log(JSON.stringify(probeWorkspace(root, scaffolded), null, 2));

function resolveRoot(argv) {
  const flag = argv.indexOf("--workspace");
  if (flag !== -1 && argv[flag + 1]) return path.resolve(argv[flag + 1]);
  return process.cwd();
}

// --- probe ---

function probeWorkspace(workspaceRoot, created) {
  const lessons = listNumbered(path.join(workspaceRoot, "lessons"));
  const records = listNumbered(path.join(workspaceRoot, "learning-records")).map((entry) => ({
    ...entry,
    ...recordDetails(path.join(workspaceRoot, "learning-records", entry.file)),
  }));

  return {
    root: workspaceRoot,
    // MISSION.md is the marker: present (even as a stub) = this dir is a
    // teaching workspace. Absent = offer to scaffold, never assume.
    exists: fs.existsSync(path.join(workspaceRoot, "MISSION.md")),
    mission: readIfPresent(workspaceRoot, "MISSION.md"),
    resources: readIfPresent(workspaceRoot, "RESOURCES.md"),
    notes: readIfPresent(workspaceRoot, "NOTES.md"),
    glossary: readIfPresent(workspaceRoot, "GLOSSARY.md"),
    lessons,
    records,
    reference: listFiles(path.join(workspaceRoot, "reference")),
    next: {
      lesson: nextNumber(lessons),
      record: nextNumber(records),
    },
    ...(created.length > 0 ? { scaffolded: created } : {}),
  };
}

function readIfPresent(dir, name) {
  const file = path.join(dir, name);
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

// Numbered artifacts are NNNN-slug.* -- parse both parts, skip anything else.
function listNumbered(dir) {
  return listFiles(dir)
    .map((file) => {
      const match = file.match(/^(\d{4})-([a-z0-9-]+)\.\w+$/i);
      return match ? { number: Number(match[1]), slug: match[2], file } : null;
    })
    .filter(Boolean)
    .toSorted((a, b) => a.number - b.number);
}

function listFiles(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .toSorted();
  } catch {
    return [];
  }
}

// Status line + a short preview, so the agent can pick which records to read
// in full instead of getting every record dumped into context.
function recordDetails(file) {
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return { status: null, preview: null };
  }
  const statusMatch = content.match(/^Status:\s*(.+)$/im);
  return {
    status: statusMatch ? statusMatch[1].trim() : "active",
    preview: content.length > 500 ? `${content.slice(0, 500)}\n...(truncated)` : content,
  };
}

function nextNumber(entries) {
  return entries.length > 0 ? entries.at(-1).number + 1 : 1;
}

// --- scaffold ---

// Create only what's missing; never overwrite. Returns the names created so
// the skill can tell the user exactly what appeared.
function scaffoldWorkspace(workspaceRoot) {
  const created = [];

  for (const dir of ["lessons", "learning-records", "reference"]) {
    const full = path.join(workspaceRoot, dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      created.push(`${dir}/`);
    }
  }

  const templates = {
    "MISSION.md": [
      "# Mission",
      "",
      "<!-- One concrete mission per workspace. 'Run a half marathon by October'",
      "     beats 'get fitter'. The agent interviews you to fill this in. -->",
      "",
    ].join("\n"),
    "RESOURCES.md": [
      "# Resources",
      "",
      "## Knowledge",
      "",
      "## Wisdom (Communities)",
      "",
      "## Gaps",
      "",
    ].join("\n"),
    "GLOSSARY.md": ["# Glossary", ""].join("\n"),
    "NOTES.md": ["# Notes", "", "<!-- Teaching preferences and scratchpad. -->", ""].join("\n"),
  };

  for (const [name, body] of Object.entries(templates)) {
    const full = path.join(workspaceRoot, name);
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, body, "utf8");
      created.push(name);
    }
  }

  return created;
}
