/**
 * Shared spec helpers, imported by the spec-family skills via `../slynk-mjs-utils/`.
 *
 * Single source for `.spec.yml` config reading plus the repo-root and
 * convention-file gathering both context helpers used to duplicate.
 * `readSpecConfig`/`gatherConventionFiles` are pure (`repoRoot` is passed in)
 * and unit-testable by direct import. `getRepoRoot` is the exception: it reads
 * `process.argv` (`--repo`) and shells out to `git rev-parse`.
 *
 * This dir has no SKILL.md, so the installer treats it as a shared lib: copied
 * verbatim under its `slynk-` name (never prefixed again, never routed). The
 * relative import resolves against the importing helper's own dir in both
 * install modes -- see docs/specs/2026-06-01-slynk-mjs-utils-shared-config.md.
 *
 * Dependency-free. node built-ins only.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Repo root: explicit `--repo <path>` wins (lets tests drive a scratch repo),
// else `git rev-parse`. Returns null outside a repo so callers degrade.
export function getRepoRoot() {
  const argumentIndex = process.argv.indexOf("--repo");
  if (argumentIndex !== -1 && process.argv[argumentIndex + 1])
    return path.resolve(process.argv[argumentIndex + 1]);

  try {
    // Silence git's own stderr so the not-in-repo case stays clean.
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

// Convention files for the tone/quality lens, in canonical order (AGENTS.md is
// this repo's canonical instruction file; CLAUDE.md is a thin pointer to it).
// Returns a name -> content map; large files are truncated.
export function gatherConventionFiles(repoRoot) {
  const names = ["AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "CONVENTIONS.md", "CONTEXT.md"];
  const found = {};
  for (const name of names) {
    const filepath = path.join(repoRoot, name);
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, "utf8");
      found[name] = content.length > 4000 ? `${content.slice(0, 4000)}\n...(truncated)` : content;
    }
  }
  return found;
}

// Read `.spec.yml` (flat key: value, avoids a js-yaml dep) and normalize the
// snake_case keys to the camelCase the skills read. No file -> defaults.
export function readSpecConfig(repoRoot) {
  const yamlPath = path.join(repoRoot, ".spec.yml");
  if (!fs.existsSync(yamlPath)) return { outputDir: "docs/specs", contextFile: "CONTEXT.md" };

  const content = fs.readFileSync(yamlPath, "utf8");
  const config = {};
  // Split on CRLF or LF so a Windows-authored .spec.yml doesn't leave a trailing
  // \r that defeats the line regex (silently dropping every override).
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      // Strip an inline `# comment` and surrounding quotes from the value.
      let value = match[2]
        .replace(/\s+#.*$/, "")
        .trim()
        .replaceAll(/^["']|["']$/g, "");
      if (value === "false") value = false;
      if (value === "true") value = true;
      config[match[1]] = value;
    }
  }
  return {
    outputDir: config.output_dir || "docs/specs",
    contextFile: config.context_file ?? "CONTEXT.md",
  };
}
