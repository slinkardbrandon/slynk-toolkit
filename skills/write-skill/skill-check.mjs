#!/usr/bin/env node
/**
 * write-skill helper: mechanical lint of one skill folder against the toolkit
 * doctrine. The checks a script can make deterministically live here; judgment
 * calls (tone, trigger overlap, slimness-in-substance) stay with the agent --
 * slynk-skill-review runs those on top of this.
 *
 * Usage: node skill-check.mjs <skill-dir>
 *
 * Returns JSON: { pass, findings: [{ level: "error"|"warn", rule, message }] }
 * Exit 0 on pass (warnings allowed), 1 when any error -- callers gate on it.
 *
 * Rules checked:
 *   frontmatter      SKILL.md exists, has --- frontmatter with name + description
 *   name             kebab-case; matches the dir name
 *   description      <= 1024 chars; carries a "Use when" trigger clause
 *   size             SKILL.md body over 300 lines -> warn (slimness smell)
 *   echo-pipe        `echo '...' | node` in SKILL.md (apostrophes break it)
 *   tool-names       runtime-specific tool names in SKILL.md (cross-agent rule)
 *   helper-deps      .mjs helpers import only node: built-ins or relative paths
 *   helper-paths     no hardcoded user/home paths in helpers
 *   sentinel         helpers exist but SKILL.md never calls them via {{SLYNK_DIR}}
 */

import fs from "node:fs";
import path from "node:path";

const target = process.argv[2];
if (!target) {
  console.error(JSON.stringify({ error: "Usage: skill-check.mjs <skill-dir>" }));
  process.exit(1);
}

const dir = path.resolve(target);
const findings = [];
const error = (rule, message) => findings.push({ level: "error", rule, message });
const warn = (rule, message) => findings.push({ level: "warn", rule, message });

checkSkill();

const pass = !findings.some((finding) => finding.level === "error");
console.log(JSON.stringify({ pass, dir, findings }, null, 2));
process.exit(pass ? 0 : 1);

function checkSkill() {
  const skillPath = path.join(dir, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    error("frontmatter", "No SKILL.md in the target dir -- not a skill.");
    return;
  }
  const content = fs.readFileSync(skillPath, "utf8");

  const frontmatter = parseFrontmatter(content);
  if (frontmatter) {
    checkName(frontmatter.name);
    checkDescription(frontmatter.description);
  } else {
    error("frontmatter", "SKILL.md has no `---` frontmatter block.");
  }

  checkBody(content);
  checkHelpers(content);
}

// Linear-scan kebab test -- the grouped regex form is backtracking-unsafe.
function isKebabCase(value) {
  return (
    /^[a-z0-9-]+$/.test(value) &&
    !value.startsWith("-") &&
    !value.endsWith("-") &&
    !value.includes("--")
  );
}

// Minimal YAML-ish reader: top-level `key: value` plus `>-` folded blocks.
// Good enough for skill frontmatter; avoids a yaml dep.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields = {};
  let currentKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    const keyMatch = line.match(/^([\w-]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      fields[currentKey] = keyMatch[2].replace(/^>-?\s*$/, "").trim();
    } else if (currentKey && /^\s+\S/.test(line)) {
      fields[currentKey] = `${fields[currentKey]} ${line.trim()}`.trim();
    }
  }
  return fields;
}

function checkName(name) {
  if (!name) {
    error("name", "Frontmatter is missing `name:`.");
    return;
  }
  if (!isKebabCase(name)) error("name", `Name "${name}" is not lowercase kebab-case.`);

  // Installed dirs carry the slynk- prefix; source dirs don't. Accept either.
  const dirName = path.basename(dir).replace(/^slynk-/, "");
  if (name !== dirName && name !== path.basename(dir))
    warn(
      "name",
      `Name "${name}" doesn't match dir "${path.basename(dir)}" -- routers key on the dir.`,
    );
}

function checkDescription(description) {
  if (!description) {
    error(
      "description",
      "Frontmatter is missing `description:` -- it's the only thing a router sees.",
    );
    return;
  }
  if (description.length > 1024)
    error("description", `Description is ${description.length} chars; cap is 1024.`);
  if (!/use (it )?when/i.test(description))
    warn(
      "description",
      'No "Use when ..." trigger clause -- without concrete trigger phrases the skill won\'t get routed to.',
    );
  if (description.length < 60)
    warn("description", "Description under 60 chars -- too thin to route on. Add what + triggers.");
}

function checkBody(content) {
  const lines = content.split("\n").length;
  if (lines > 300)
    warn("size", `SKILL.md is ${lines} lines -- consider moving depth to sibling reference files.`);

  // `'...'` as the payload is the doc-mention form ("never `echo '...' | node`"),
  // not a real pipe -- skip it so a skill may name the anti-pattern.
  if (/echo\s+(['"])(?!\.\.\.\1).*\1\s*\|\s*node/.test(content))
    error(
      "echo-pipe",
      "`echo '...' | node` found -- apostrophes break it. Use a scratch file or stdin.",
    );

  // Runtime-specific task/todo tool names drift per runtime and version; the
  // cross-agent rule is to gate on capability, not name them.
  const toolNames = content.match(/\b(TodoWrite|TaskCreate|todowrite|update_plan)\b/g);
  if (toolNames)
    warn(
      "tool-names",
      `Runtime-specific tool name(s) ${[...new Set(toolNames)].join(", ")} in SKILL.md -- describe the capability instead.`,
    );
}

function checkHelpers(skillContent) {
  const helpers = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mjs"))
    .toSorted();

  for (const helper of helpers) {
    const source = fs.readFileSync(path.join(dir, helper), "utf8");

    for (const specifier of importSpecifiers(source)) {
      const allowed =
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../");
      if (!allowed)
        error(
          "helper-deps",
          `${helper} imports "${specifier}" -- helpers must be dependency-free (node: built-ins or relative paths only).`,
        );
    }

    // Scan code lines only -- example paths in doc comments are fine.
    const codeLines = source
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    if (/(["'`])(?:\/Users\/|\/home\/|[A-Za-z]:\\)/.test(codeLines))
      warn("helper-paths", `${helper} contains a hardcoded user path -- resolve paths at runtime.`);
  }

  if (helpers.length > 0 && !skillContent.includes("{{SLYNK_DIR}}"))
    warn(
      "sentinel",
      `Helpers exist (${helpers.join(", ")}) but SKILL.md never invokes them via {{SLYNK_DIR}} -- they won't be found after install.`,
    );
}

// Static imports, bare side-effect imports, and dynamic import/require calls
// with a literal specifier. A computed specifier still slips past -- this is
// a lint, not a sandbox.
function importSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm))
    specifiers.push(match[1]);
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specifiers.push(match[1]);
  for (const match of source.matchAll(/\b(?:import|require)\(\s*["']([^"']+)["']\s*\)/g))
    specifiers.push(match[1]);
  return specifiers;
}
