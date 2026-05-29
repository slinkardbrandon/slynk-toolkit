#!/usr/bin/env node
/**
 * spec helper: Gathers repo context that the skill needs in Phase 0.
 *
 * Outputs a JSON blob with everything the agent needs to skip token-expensive
 * exploration for things that are mechanical to look up:
 *   - repo root, name, default branch
 *   - convention files content (CONTRIBUTING, CONTEXT, CLAUDE, AGENTS, etc.)
 *   - instruction files content
 *   - recent spec artifacts (last 5)
 *   - package.json scripts (for knowing what gates exist)
 *   - spec config (.spec.yml if present)
 *
 * Usage: node spec-context.mjs [--repo /path/to/repo]
 *
 * The agent calls this ONCE at the start of Phase 0, gets a structured blob,
 * and avoids 5-10 separate file reads that each cost tokens.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const repoRoot = getRepoRoot();
if (!repoRoot) {
  console.error(JSON.stringify({ error: "Not inside a git repository" }));
  process.exit(1);
}

const result = {
  repo: {
    root: repoRoot,
    name: path.basename(repoRoot),
    defaultBranch: getDefaultBranch(),
    hasNodeModules: fs.existsSync(path.join(repoRoot, "node_modules")),
  },
  conventions: gatherConventionFiles(),
  instructions: gatherInstructionFiles(),
  specHistory: getRecentSpecDocs(),
  config: readSpecConfig(),
  packageScripts: getPackageScripts(),
};

console.log(JSON.stringify(result, null, 2));

// --- helpers ---

function getRepoRoot() {
  const argumentIndex = process.argv.indexOf("--repo");
  if (argumentIndex !== -1 && process.argv[argumentIndex + 1])
    return path.resolve(process.argv[argumentIndex + 1]);

  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function getDefaultBranch() {
  try {
    return execSync("gh repo view --json defaultBranchRef --jq .defaultBranchRef.name", {
      encoding: "utf8",
      cwd: repoRoot,
    }).trim();
  } catch {
    return "master";
  }
}

function gatherConventionFiles() {
  const names = ["CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md", "CONVENTIONS.md", "CONTEXT.md"];
  const found = {};
  for (const name of names) {
    const filepath = path.join(repoRoot, name);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, "utf8");
      // Truncate very large files to keep output reasonable
      found[name] = content.length > 4000 ? `${content.slice(0, 4000)}\n...(truncated)` : content;
    }
  }
  return found;
}

function gatherInstructionFiles() {
  const instructionsDir = path.join(repoRoot, ".github", "instructions");
  if (!fs.existsSync(instructionsDir)) return {};

  const found = {};
  try {
    const files = fs
      .readdirSync(instructionsDir, { recursive: true })
      .filter((f) => f.endsWith(".instructions.md"))
      .map((f) => path.join(instructionsDir, f));

    for (const filepath of files) {
      const relativePath = path.relative(repoRoot, filepath);
      const content = fs.readFileSync(filepath, "utf8");
      found[relativePath] =
        content.length > 2000 ? `${content.slice(0, 2000)}\n...(truncated)` : content;
    }
  } catch {
    // directory not readable
  }
  return found;
}

function getRecentSpecDocs() {
  const config = readSpecConfig();
  const specDir = path.join(repoRoot, config.outputDir || "docs/specs");

  if (!fs.existsSync(specDir)) return [];

  try {
    const files = fs
      .readdirSync(specDir)
      .filter((f) => f.endsWith(".md"))
      .toSorted()
      .toReversed()
      .slice(0, 5);

    return files.map((f) => {
      const content = fs.readFileSync(path.join(specDir, f), "utf8");
      // Only return first 500 chars as summary
      return {
        filename: f,
        preview: content.slice(0, 500),
      };
    });
  } catch {
    return [];
  }
}

function readSpecConfig() {
  const yamlPath = path.join(repoRoot, ".spec.yml");
  if (!fs.existsSync(yamlPath)) return { outputDir: "docs/specs", contextFile: "CONTEXT.md" };

  // Simple YAML parser for our flat config (avoids needing js-yaml dep)
  const content = fs.readFileSync(yamlPath, "utf8");
  const config = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      let value = match[2].trim();
      if (value === "false") value = false;
      if (value === "true") value = true;
      config[match[1]] = value;
    }
  }
  return { outputDir: "docs/specs", contextFile: "CONTEXT.md", ...config };
}

function getPackageScripts() {
  const packagePath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packagePath)) return null;

  try {
    const package_ = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return package_.scripts || {};
  } catch {
    return null;
  }
}
