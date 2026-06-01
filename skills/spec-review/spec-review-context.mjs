#!/usr/bin/env node
/**
 * spec-review helper: resolves the spec to review and the convention files the
 * tone lens needs, in one shot.
 *
 * Outputs a JSON blob with everything the single review pass needs so the agent
 * skips token-expensive lookup:
 *   - repo root + name
 *   - the target spec: explicit path, else the latest spec in output_dir
 *   - spec config (.spec.yml output_dir / context_file, if present)
 *   - convention files (AGENTS.md, CONTEXT.md, ...) for the tone-quality lens
 *   - a graceful `error` string when no spec can be found (never throws)
 *
 * Usage:
 *   node spec-review-context.mjs [<spec-path>] [--repo /path/to/repo]
 *   node spec-review-context.mjs --spec docs/specs/foo.md
 *
 * Target resolution:
 *   1. An explicit path (positional or --spec) -- resolved against cwd if relative.
 *      Missing -> graceful error, no throw.
 *   2. No path -> the latest .md in output_dir (reverse filename sort; specs are
 *      date-stamped so newest sorts last). None -> graceful error.
 *
 * Dependency-free. Resolves its own paths. The flavor arg is the agent's
 * concern, not the helper's -- this only locates and reads the spec.
 */

import fs from "node:fs";
import path from "node:path";

import {
  getRepoRoot,
  gatherConventionFiles,
  readSpecConfig,
} from "../slynk-mjs-utils/spec-config.mjs";

const repoRoot = getRepoRoot();
const base = repoRoot || process.cwd();
const config = readSpecConfig(base);

const result = {
  repo: { root: repoRoot, name: repoRoot ? path.basename(repoRoot) : null },
  config,
  conventions: gatherConventionFiles(base),
  spec: null,
  error: null,
};

const { spec, error } = resolveSpec(base, config);
result.spec = spec;
result.error = error;

console.log(JSON.stringify(result, null, 2));

// --- spec resolution ---

function resolveSpec(baseDir, config_) {
  const explicit = getExplicitPath();
  if (explicit) {
    const absolute = path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile())
      return { spec: null, error: `No spec found at ${explicit}` };
    return { spec: readSpec(baseDir, absolute), error: null };
  }

  const specDir = path.resolve(baseDir, config_.outputDir);
  if (!fs.existsSync(specDir))
    return { spec: null, error: `No spec dir at ${config_.outputDir}. Pass an explicit path.` };

  let latest;
  try {
    latest = fs
      .readdirSync(specDir)
      .filter((f) => f.endsWith(".md"))
      .toSorted()
      .at(-1);
  } catch {
    latest = undefined;
  }
  if (!latest)
    return { spec: null, error: `No spec found in ${config_.outputDir}. Pass an explicit path.` };

  return { spec: readSpec(baseDir, path.join(specDir, latest)), error: null };
}

function readSpec(baseDir, absolute) {
  return {
    path: absolute,
    relativePath: path.relative(baseDir, absolute),
    content: fs.readFileSync(absolute, "utf8"),
  };
}

function getExplicitPath() {
  const flagIndex = process.argv.indexOf("--spec");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) return process.argv[flagIndex + 1];

  // First positional arg (skip node + script + any --flag and its value).
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index++) {
    if (args[index].startsWith("--")) {
      index++; // skip the flag's value
      continue;
    }
    return args[index];
  }
  return null;
}
