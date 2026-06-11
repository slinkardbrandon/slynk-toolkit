#!/usr/bin/env node
/**
 * teach helper: writes a workspace artifact with correct numbering, then
 * optionally opens it.
 *
 * Usage:
 *   node write-lesson.mjs --kind lesson    --slug <slug> --content <file|-> [--workspace /path] [--open]
 *   node write-lesson.mjs --kind record    --slug <slug> --content <file|->
 *   node write-lesson.mjs --kind reference --slug <slug> --content <file|->
 *
 * Kinds:
 *   lesson    -> lessons/NNNN-<slug>.html          (numbered, never overwritten)
 *   record    -> learning-records/NNNN-<slug>.md   (numbered, never overwritten)
 *   reference -> reference/<slug>.html             (living doc, overwrite allowed)
 *
 * Returns JSON: { path, absolute, number, opened }
 *
 * Saves the agent from numbering races, mkdir, and platform-specific open
 * commands. Content comes from a scratch file or stdin (-) -- never pipe prose
 * through `echo`, apostrophes break it.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const KINDS = {
  lesson: { dir: "lessons", ext: ".html", numbered: true },
  record: { dir: "learning-records", ext: ".md", numbered: true },
  reference: { dir: "reference", ext: ".html", numbered: false },
};

const args = process.argv.slice(2);
const kindName = readFlag("--kind");
const slug = readFlag("--slug");
const contentSource = readFlag("--content") || "-";

const kind = KINDS[kindName];
if (!kind) fail(`Invalid --kind: expected one of ${Object.keys(KINDS).join(", ")}`);

// Slug becomes a filename joined onto the workspace, so constrain it to
// kebab-case. Rejecting dots and slashes blocks `../` path traversal.
if (!slug || !/^[a-z0-9-]+$/i.test(slug))
  fail("Invalid --slug: use only letters, digits, and hyphens");

const root = resolveRoot();
// MISSION.md marks a teaching workspace. Refusing to write without it stops
// artifacts from scattering into an arbitrary cwd.
if (!fs.existsSync(path.join(root, "MISSION.md")))
  fail(`No MISSION.md at ${root} -- not a teaching workspace. Run teach-workspace.mjs --scaffold.`);

const content =
  contentSource === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(contentSource, "utf8");

const fullDir = path.join(root, kind.dir);
fs.mkdirSync(fullDir, { recursive: true });

const number = kind.numbered ? nextNumber(fullDir) : null;
const filename = kind.numbered
  ? `${String(number).padStart(4, "0")}-${slug}${kind.ext}`
  : `${slug}${kind.ext}`;
const fullPath = path.join(fullDir, filename);

// Numbered artifacts are append-only history; reference docs are living and
// may be rewritten in place.
if (kind.numbered && fs.existsSync(fullPath)) fail(`Refusing to overwrite ${fullPath}`);

fs.writeFileSync(fullPath, content, "utf8");

const opened = args.includes("--open") ? openFile(fullPath) : false;

console.log(
  JSON.stringify({
    path: path.join(kind.dir, filename),
    absolute: fullPath,
    number,
    opened,
  }),
);

function readFlag(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function resolveRoot() {
  const flagged = readFlag("--workspace");
  return flagged ? path.resolve(flagged) : process.cwd();
}

// Next free number = max existing + 1, scanning NNNN-* names. Re-scanned at
// write time (not taken from a stale probe) so two writes in a session can't
// collide.
function nextNumber(dir) {
  const numbers = fs
    .readdirSync(dir)
    .map((file) => file.match(/^(\d{4})-/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

// Best-effort, platform-gated open. Failure is a `false` in the JSON, never a
// crash -- headless runtimes simply tell the user the path instead.
function openFile(file) {
  const openers = { darwin: ["open", [file]], win32: ["cmd", ["/c", "start", "", file]] };
  const [bin, binArgs] = openers[process.platform] || ["xdg-open", [file]];
  try {
    execFileSync(bin, binArgs, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}
