#!/usr/bin/env node
/**
 * skill-review helper: resolves the skill under review and loads everything
 * one pass needs -- SKILL.md, helper sources, and the sibling mechanical lint.
 *
 * Usage: node skill-review-context.mjs <skill-dir>
 *
 * Emits one JSON blob:
 *   {
 *     dir,
 *     skillMd,                          // full SKILL.md content (the review target)
 *     helpers: [{ name, source }],      // .mjs sources, large ones truncated
 *     references: ["LESSON-FORMAT.md"], // sibling docs by name (read on demand)
 *     mechanical,                       // skill-check.mjs output, or null
 *     error                             // string when the target isn't a skill
 *   }
 *
 * The mechanical lint is delegated to the sibling write-skill helper -- one
 * source of truth for the deterministic rules. Its dir differs by install mode
 * (`write-skill` in a dev --link clone, `slynk-write-skill` in a copy install),
 * so resolve at runtime like brainstorm does for spec-context.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const target = process.argv[2];
if (!target) {
  console.log(JSON.stringify({ error: "Usage: skill-review-context.mjs <skill-dir>" }, null, 2));
  process.exit(0);
}

const dir = path.resolve(target);
console.log(JSON.stringify(gather(dir), null, 2));

function gather(skillDir) {
  const skillPath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    return { dir: skillDir, error: `No SKILL.md at ${skillDir} -- not a skill.` };
  }

  const entries = listFiles(skillDir);
  return {
    dir: skillDir,
    skillMd: fs.readFileSync(skillPath, "utf8"),
    helpers: entries
      .filter((file) => file.endsWith(".mjs"))
      .map((name) => ({ name, source: truncate(read(path.join(skillDir, name))) })),
    references: entries.filter((file) => file.endsWith(".md") && file !== "SKILL.md"),
    mechanical: runMechanicalCheck(skillDir),
    error: null,
  };
}

function listFiles(skillDir) {
  try {
    return fs
      .readdirSync(skillDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .toSorted();
  } catch {
    return [];
  }
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function truncate(content) {
  if (content === null) return null;
  return content.length > 8000 ? `${content.slice(0, 8000)}\n...(truncated)` : content;
}

// Sibling resolution mirrors brainstorm-sources.mjs: `write-skill` in a dev
// clone, `slynk-write-skill` in a copy install. Missing sibling -> null; the
// review still runs, the agent just notes the mechanical pass was skipped.
function runMechanicalCheck(skillDir) {
  for (const sibling of ["write-skill", "slynk-write-skill"]) {
    const checker = path.join(HERE, "..", sibling, "skill-check.mjs");
    if (!fs.existsSync(checker)) continue;
    try {
      const out = execFileSync(process.execPath, [checker, skillDir], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return JSON.parse(out);
    } catch (error) {
      // Exit 1 = errors found; stdout still carries the JSON report.
      try {
        return JSON.parse(error.stdout);
      } catch {
        return null;
      }
    }
  }
  return null;
}
