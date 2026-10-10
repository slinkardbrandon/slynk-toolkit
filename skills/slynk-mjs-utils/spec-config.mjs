/**
 * Shared helpers, imported by toolkit skills via `../slynk-mjs-utils/`.
 *
 * Single source for `.slynk.yml` config reading (legacy `.spec.yml` still read)
 * plus the repo-root and convention-file gathering the context helpers share.
 * The config readers and `gatherConventionFiles` are pure (`repoRoot` is passed in)
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

// --- .slynk.yml (unified toolkit config) ------------------------------------

const DEFAULT_SPEC = { outputDir: "docs/specs", contextFile: "CONTEXT.md" };
const CLAIM_CLASSES = ["paths", "scripts", "links"];
const DEFAULT_DRIFT_LABEL = "agent: drift";

// A malformed config section. Callers map it to their own exit code (drift: 2).
export class ConfigError extends Error {}

// Strip an inline `# comment` and surrounding quotes; coerce true/false; expand
// an inline flow list (`[a, "b"]`) to an array.
function parseValue(raw) {
  const value = raw.replace(/\s+#.*$/, "").trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => parseValue(item))
      .filter((item) => item !== "");
  }
  const unquoted = value.replaceAll(/^["']|["']$/g, "");
  if (unquoted === "false") return false;
  if (unquoted === "true") return true;
  return unquoted;
}

/**
 * Parse the subset of YAML `.slynk.yml` uses (no js-yaml dep): top-level
 * sections, scalar keys, inline flow lists, and block lists of flat maps whose
 * values are scalars or flow lists. Nothing deeper. Legacy flat `.spec.yml`
 * (top-level scalars only) parses too.
 */
export function parseSlynkYaml(text) {
  const root = {};
  let section = null; // the current top-level section object
  let sectionIndent = null; // indent of that section's own keys
  let list = null; // the block list currently being filled
  let item = null; // the list item (flat map) currently being filled

  // Split on CRLF or LF so a Windows-authored file doesn't leave a trailing \r
  // that defeats the line regexes (silently dropping every override).
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();

    if (indent === 0) {
      const match = body.match(/^([\w-]+):\s*(.*)$/);
      if (!match) continue;
      list = null;
      item = null;
      if (match[2] === "" || match[2].startsWith("#")) {
        section = {};
        sectionIndent = null;
        root[match[1]] = section;
      } else {
        section = null;
        root[match[1]] = parseValue(match[2]);
      }
      continue;
    }
    if (!section) continue;

    const dash = body.match(/^-\s+([\w-]+):\s*(.*)$/);
    if (dash && list) {
      item = { [dash[1]]: parseValue(dash[2]) };
      list.push(item);
      continue;
    }
    const match = body.match(/^([\w-]+):\s*(.*)$/);
    if (!match) continue;
    sectionIndent ??= indent;
    if (item && indent > sectionIndent) {
      item[match[1]] = parseValue(match[2]);
    } else if (match[2] === "" || match[2].startsWith("#")) {
      list = [];
      item = null;
      section[match[1]] = list;
    } else {
      list = null;
      item = null;
      section[match[1]] = parseValue(match[2]);
    }
  }
  return root;
}

// Parsed `.slynk.yml`, or null when the repo has none.
export function readSlynkConfig(repoRoot) {
  const yamlPath = path.join(repoRoot, ".slynk.yml");
  if (!fs.existsSync(yamlPath)) return null;
  return parseSlynkYaml(fs.readFileSync(yamlPath, "utf8"));
}

// Spec config: the `spec:` section of `.slynk.yml`, else legacy `.spec.yml`
// (flat keys), else defaults. snake_case keys normalize to camelCase.
export function readSpecConfig(repoRoot) {
  let config = readSlynkConfig(repoRoot)?.spec;
  if (!config) {
    const legacyPath = path.join(repoRoot, ".spec.yml");
    if (!fs.existsSync(legacyPath)) return { ...DEFAULT_SPEC };
    config = parseSlynkYaml(fs.readFileSync(legacyPath, "utf8"));
  }
  return {
    outputDir: config.output_dir || DEFAULT_SPEC.outputDir,
    contextFile: config.context_file ?? DEFAULT_SPEC.contextFile,
  };
}

const asList = (value) => {
  if (value === undefined || value === "") return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
};

// Repo-relative only: an absolute path or a `..` segment escapes the repo.
function assertRepoRelative(value, where) {
  if (path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.split(/[/\\]/).includes("..")) {
    throw new ConfigError(`${where}: "${value}" must be repo-relative (no absolute path, no "..")`);
  }
}

/**
 * The normalized `drift:` section, or null when absent (callers print
 * "run slynk-drift init" guidance rather than scanning). Throws ConfigError on
 * an invalid manifest.
 */
export function readDriftConfig(repoRoot) {
  const drift = readSlynkConfig(repoRoot)?.drift;
  if (!drift || typeof drift !== "object") return null;

  const notify = drift.notify || null;
  if (notify !== null) {
    let url;
    try {
      url = new URL(notify);
    } catch {
      throw new ConfigError(`drift.notify: "${notify}" is not a URL`);
    }
    if (url.protocol !== "https:") throw new ConfigError("drift.notify: only https URLs allowed");
  }

  const entries = Array.isArray(drift.docs) ? drift.docs : [];
  if (entries.length === 0) throw new ConfigError("drift.docs: at least one doc entry required");

  // Specs are point-in-time records: never valid drift targets.
  const specDir = `${path.posix.normalize(readSpecConfig(repoRoot).outputDir).replace(/\/$/, "")}/`;
  const docs = entries.map((entry, index) => {
    const where = `drift.docs[${index}]`;
    if (!entry.path) throw new ConfigError(`${where}: missing path`);
    assertRepoRelative(entry.path, `${where}.path`);
    if (`${path.posix.normalize(entry.path)}/`.startsWith(specDir)) {
      throw new ConfigError(
        `${where}.path: specs (${specDir}) are point-in-time records, not drift targets`,
      );
    }
    const sources = asList(entry.sources);
    for (const source of sources) assertRepoRelative(source, `${where}.sources`);

    const recencyOnly = entry.recency_only === true;
    if (recencyOnly && entry.claims !== undefined) {
      throw new ConfigError(`${where}: set claims or recency_only, not both`);
    }
    let claims = [];
    if (!recencyOnly)
      claims = entry.claims === undefined ? [...CLAIM_CLASSES] : asList(entry.claims);
    for (const claim of claims) {
      if (!CLAIM_CLASSES.includes(claim)) {
        throw new ConfigError(
          `${where}.claims: unknown class "${claim}" (${CLAIM_CLASSES.join(", ")})`,
        );
      }
    }
    return { path: entry.path, sources, claims, recencyOnly, ignore: asList(entry.ignore) };
  });

  return { label: drift.label || DEFAULT_DRIFT_LABEL, notify, docs };
}
