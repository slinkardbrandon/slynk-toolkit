#!/usr/bin/env node
/**
 * drift helper: deterministic fact-drift checker. No LLM, no network.
 *
 * Sweeps every doc in the `.slynk.yml` `drift:` manifest, full repo, every run:
 *   - paths:   inline-code path claims resolve to tracked (or gitignored) files
 *   - scripts: `pnpm run <name>` / `npm run <name>` exist in some package.json
 *   - links:   repo-internal markdown links and anchors resolve (external skipped)
 *   - recency: the doc's last commit is older than its mapped sources' last commit
 * Extraction contract: docs/specs/2026-10-10-slynk-drift-doc-drift-skill.md.
 *
 * Usage:
 *   node drift-check.mjs [--repo <path>] [--json]
 *   node drift-check.mjs --self-test [--fixture <dir>]
 *
 * Exit codes: 0 clean, 1 findings, 2 config or checker error.
 * Dependency-free. Resolves its own paths.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ConfigError,
  getRepoRoot,
  isGitWorkTree,
  readDriftConfig,
} from "../slynk-mjs-utils/spec-config.mjs";

const SELF = fileURLToPath(import.meta.url);
const BUNDLED_FIXTURE = path.join(path.dirname(SELF), "fixtures", "self-test");
const INIT_GUIDANCE = "no drift: section in .slynk.yml; run slynk-drift init";

// The bundled fixture's planted drifts. The self-test passes only when the
// checker finds exactly these: a miss means detection broke, an extra means a
// false positive crept in.
const PLANTS = [
  { claim: "paths", token: "src/removed.js" },
  { claim: "scripts", token: "vanished" },
  { claim: "links", token: "docs/guide.md#missing-section" },
];

// --- extraction (pure) -------------------------------------------------------

// Lines outside fenced code blocks, 1-indexed. Fenced blocks are examples and
// transcripts, never claims.
function proseLines(markdown) {
  const lines = [];
  let fence = null;
  for (const [index, text] of markdown.split(/\r?\n/).entries()) {
    const marker = text.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      const closes = marker && marker[1][0] === fence[0] && marker[1].length >= fence.length;
      if (closes && text.trim() === marker[1]) fence = null;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    lines.push({ line: index + 1, text });
  }
  return lines;
}

// Inline code spans on one line: a run of N backticks closed by exactly N.
function spansInLine(text) {
  const spans = [];
  let index = 0;
  const runAt = (at) => {
    let length = 0;
    while (text[at + length] === "`") length++;
    return length;
  };
  while (index < text.length) {
    if (text[index] !== "`") {
      index++;
      continue;
    }
    const open = runAt(index);
    let search = index + open;
    let close = -1;
    while (search < text.length) {
      if (text[search] !== "`") {
        search++;
        continue;
      }
      const run = runAt(search);
      if (run === open) {
        close = search;
        break;
      }
      search += run;
    }
    if (close === -1) {
      index += open;
      continue;
    }
    spans.push({ start: index, end: close + open, text: text.slice(index + open, close).trim() });
    index = close + open;
  }
  return spans;
}

export function extractSpans(markdown) {
  return proseLines(markdown).flatMap(({ line, text }) =>
    spansInLine(text).map((span) => ({ line, text: span.text })),
  );
}

// Inline `](target)` links and `[ref]: target` definitions, outside code.
export function extractLinks(markdown) {
  const links = [];
  for (const { line, text } of proseLines(markdown)) {
    let bare = text;
    for (const span of spansInLine(text)) {
      bare = bare.slice(0, span.start) + " ".repeat(span.end - span.start) + bare.slice(span.end);
    }
    const definition = bare.match(/^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)/);
    if (definition) {
      links.push({ line, target: definition[1] });
      continue;
    }
    for (const match of bare.matchAll(/\]\(<?([^)\s>]*)[^)]*\)/g)) {
      if (match[1]) links.push({ line, target: match[1] });
    }
  }
  return links;
}

function slugify(heading) {
  return heading
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replaceAll(" ", "-");
}

// GitHub heading anchors (ATX + setext, `-N` suffix for duplicates) plus any
// explicit html `id`/`name` anchors.
export function githubSlugs(markdown) {
  const slugs = new Set();
  const seen = new Map();
  const add = (slug) => {
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    slugs.add(count === 0 ? slug : `${slug}-${count}`);
  };
  const lines = proseLines(markdown);
  for (const [index, { line, text }] of lines.entries()) {
    const atx = text.match(/^ {0,3}#{1,6}\s+(.*)$/);
    if (atx) {
      add(slugify(atx[1].replace(/\s#+\s*$/, "")));
    } else {
      const next = lines[index + 1];
      const setext =
        next && next.line === line + 1 && /^ {0,3}(?:=+|-+)\s*$/.test(next.text) && text.trim();
      if (setext && !/^\s*(?:[-*+>]|\d+\.)\s/.test(text)) add(slugify(text));
    }
    for (const match of text.matchAll(/\s(?:id|name)="([^"]+)"/g))
      slugs.add(match[1].toLowerCase());
  }
  return slugs;
}

// Every `pnpm run <name>` / `npm run <name>` in a span. Other runners and bare
// `pnpm <name>` are ambiguous and skipped.
function scriptNames(span) {
  return [...span.matchAll(/(?:^|\s)(?:pnpm|npm) run ([\w:.-]+)/g)].map((match) => match[1]);
}

export function parseScriptName(span) {
  return scriptNames(span)[0] ?? null;
}

function isPathShaped(token) {
  if (!/^[\w./-]+$/.test(token) || !token.includes("/")) return false;
  const segments = token.replace(/\/$/, "").split("/");
  return segments.length > 1 && segments.every((segment) => segment !== "");
}

// Pinned to the verbatim doc line, never paraphrased text, so IDs stay stable.
export function findingId(doc, lineText) {
  return createHash("sha256").update(`${doc}\n${lineText}`).digest("hex").slice(0, 8);
}

// --- repo-backed checks ------------------------------------------------------

function gitIn(repoRoot) {
  return (args) =>
    spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
}

function repoIndex(repoRoot) {
  const git = gitIn(repoRoot);
  const files = git(["ls-files", "-z"]).stdout.split("\0").filter(Boolean);
  const tracked = new Set(files);
  const directories = new Set();
  for (const file of files) {
    const parts = file.split("/");
    for (let depth = 1; depth < parts.length; depth++)
      directories.add(parts.slice(0, depth).join("/"));
  }
  const topLevel = new Set(files.map((file) => file.split("/")[0]));

  const scripts = new Set();
  for (const file of files.filter((name) => path.posix.basename(name) === "package.json")) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));
      for (const name of Object.keys(manifest.scripts ?? {})) scripts.add(name);
    } catch {
      // An unreadable package.json contributes no scripts; never fatal.
    }
  }

  const ignored = (token) => git(["check-ignore", "-q", "--", token]).status === 0;
  // Exact tracked file, any tracked file under it as a directory, or a
  // gitignored (documented generated) artifact.
  const resolves = (token) => {
    const bare = token.replace(/\/$/, "");
    return tracked.has(bare) || directories.has(bare) || ignored(token);
  };
  return { tracked, topLevel, scripts, resolves };
}

function lastCommit(repoRoot, pathspecs) {
  if (pathspecs.length === 0) return null;
  const out = gitIn(repoRoot)(["log", "-1", "--format=%H%x09%ct%x09%s", "--", ...pathspecs]).stdout;
  if (!out.trim()) return null;
  const [sha, time, ...subject] = out.trim().split("\t");
  return { sha, time: Number(time), subject: subject.join("\t") };
}

function isAncestor(repoRoot, ancestor, descendant) {
  return gitIn(repoRoot)(["merge-base", "--is-ancestor", ancestor, descendant]).status === 0;
}

function recencyFinding(repoRoot, entry) {
  const docCommit = lastCommit(repoRoot, [`:(literal)${entry.path}`]);
  const sourceCommit = lastCommit(repoRoot, entry.sources);
  if (!docCommit || !sourceCommit || docCommit.sha === sourceCommit.sha) return null;
  const sourcesNewer =
    isAncestor(repoRoot, docCommit.sha, sourceCommit.sha) ||
    (!isAncestor(repoRoot, sourceCommit.sha, docCommit.sha) && sourceCommit.time > docCommit.time);
  if (!sourcesNewer) return null;
  return {
    id: null,
    doc: entry.path,
    line: null,
    claim: "recency",
    token: null,
    text: null,
    message: `sources changed after the doc (doc ${docCommit.sha.slice(0, 7)}, sources ${sourceCommit.sha.slice(0, 7)})`,
    docCommit: docCommit.sha,
    sourceCommit: sourceCommit.sha,
    sourceSubject: sourceCommit.subject,
  };
}

function anchorReader(repoRoot) {
  const cache = new Map();
  return (file) => {
    if (!cache.has(file)) {
      const full = path.join(repoRoot, file);
      cache.set(file, existsSync(full) ? githubSlugs(readFileSync(full, "utf8")) : null);
    }
    return cache.get(file);
  };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Why a repo-internal link fails, or null when it resolves (or is external).
function linkProblem(doc, target, index, anchorsOf) {
  if (/^[a-z][\d+.a-z-]*:/i.test(target) || target.startsWith("//")) return null;
  const hashAt = target.indexOf("#");
  const filePart = safeDecode((hashAt === -1 ? target : target.slice(0, hashAt)).split("?")[0]);
  const anchor = hashAt === -1 ? "" : safeDecode(target.slice(hashAt + 1));

  let resolved = doc;
  if (filePart !== "") {
    const joined = filePart.startsWith("/")
      ? filePart.slice(1)
      : path.posix.join(path.posix.dirname(doc), filePart);
    resolved = path.posix.normalize(joined).replace(/\/$/, "");
    if (resolved === ".." || resolved.startsWith("../")) return "link escapes the repo";
    if (!index.resolves(resolved)) return `link target not found: ${resolved}`;
  }
  if (anchor && /\.(?:md|markdown)$/i.test(resolved)) {
    const anchors = anchorsOf(resolved);
    if (anchors && !anchors.has(anchor.toLowerCase())) return `anchor not found: #${anchor}`;
  }
  return null;
}

/** Run every check in the manifest against the repo. Pure aside from git + fs reads. */
export function checkRepo(repoRoot, config) {
  const index = repoIndex(repoRoot);
  const anchorsOf = anchorReader(repoRoot);
  const findings = [];

  for (const entry of config.docs) {
    const docPath = path.join(repoRoot, entry.path);
    if (!existsSync(docPath)) {
      findings.push({
        id: null,
        doc: entry.path,
        line: null,
        claim: "doc",
        token: entry.path,
        text: null,
        message: "manifest doc not found",
      });
      continue;
    }
    const markdown = readFileSync(docPath, "utf8");
    const lines = markdown.split(/\r?\n/);
    const ignore = new Set(entry.ignore);
    const facts = [];
    const flag = (line, claim, token, message) =>
      facts.push({
        id: findingId(entry.path, lines[line - 1]),
        doc: entry.path,
        line,
        claim,
        token,
        text: lines[line - 1],
        message,
      });

    for (const span of extractSpans(markdown)) {
      if (ignore.has(span.text)) continue;
      if (entry.claims.includes("scripts")) {
        for (const name of scriptNames(span.text)) {
          if (!index.scripts.has(name))
            flag(span.line, "scripts", name, `no package.json script "${name}"`);
        }
      }
      if (
        entry.claims.includes("paths") &&
        !span.text.startsWith("@") &&
        !/[*?[\]{}<>$]/.test(span.text) &&
        isPathShaped(span.text) &&
        index.topLevel.has(span.text.split("/")[0]) &&
        !index.resolves(span.text)
      ) {
        flag(span.line, "paths", span.text, `path not tracked: ${span.text}`);
      }
    }
    if (entry.claims.includes("links")) {
      for (const link of extractLinks(markdown)) {
        if (ignore.has(link.target)) continue;
        const problem = linkProblem(entry.path, link.target, index, anchorsOf);
        if (problem) flag(link.line, "links", link.target, problem);
      }
    }
    facts.sort((a, b) => a.line - b.line);
    findings.push(...facts);

    const recency = recencyFinding(repoRoot, entry);
    if (recency) findings.push(recency);
  }

  const head = gitIn(repoRoot)(["rev-parse", "HEAD"]).stdout.trim() || null;
  return { repo: repoRoot, head, findings };
}

// --- self-test (positive control) ---------------------------------------------

/**
 * Copy the fixture into a fresh temp repo, commit it with host git config
 * isolated, and run the real CLI pipeline against it via --repo. Passes only
 * when exactly the planted drifts come back.
 */
export function runSelfTest(fixture = BUNDLED_FIXTURE) {
  const dir = mkdtempSync(path.join(tmpdir(), "slynk-drift-selftest-"));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=drift",
        "-c",
        "user.email=drift@local",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "init.defaultBranch=main",
        ...args,
      ],
      { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] },
    );
  try {
    cpSync(fixture, dir, { recursive: true });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "fixture");

    const run = spawnSync(process.execPath, [SELF, "--repo", dir, "--json"], {
      encoding: "utf8",
      env,
    });
    if (run.status === 2) {
      return {
        ok: false,
        line: `Self-test FAILED: checker error (${run.stdout.trim() || run.stderr.trim()})`,
      };
    }
    const { findings } = JSON.parse(run.stdout);
    const key = (finding) => `${finding.claim}:${finding.token}`;
    const found = new Set(findings.map((finding) => key(finding)));
    const planted = new Set(PLANTS.map((plant) => key(plant)));
    const missed = [...planted].filter((plant) => !found.has(plant));
    const extra = [...found].filter((item) => !planted.has(item));
    if (missed.length === 0 && extra.length === 0) {
      return { ok: true, line: `Self-test OK: ${PLANTS.length}/${PLANTS.length} plants found.` };
    }
    const parts = [];
    if (missed.length > 0) parts.push(`missed ${missed.join(", ")}`);
    if (extra.length > 0) parts.push(`unexpected ${extra.join(", ")}`);
    return { ok: false, line: `Self-test FAILED: ${parts.join("; ")}` };
  } catch (error) {
    return { ok: false, line: `Self-test FAILED: ${error.message.split("\n")[0]}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- CLI -----------------------------------------------------------------------

function formatTable(result) {
  if (result.findings.length === 0) return "No fact drift found.";
  return result.findings
    .map((finding) => {
      const where = finding.line ? `${finding.doc}:${finding.line}` : finding.doc;
      return `${where}\t${finding.claim}\t${finding.message}`;
    })
    .join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const fail = (message) => {
    if (json) console.log(JSON.stringify({ error: message }));
    else console.error(message);
    process.exit(2);
  };

  if (args.includes("--self-test")) {
    const fixtureAt = args.indexOf("--fixture");
    const fixture = fixtureAt === -1 ? undefined : path.resolve(args[fixtureAt + 1]);
    const result = runSelfTest(fixture);
    console.log(json ? JSON.stringify(result) : result.line);
    process.exit(result.ok ? 0 : 2);
  }

  if (spawnSync("git", ["--version"]).error) fail("git not found: drift-check needs git");
  const repoRoot = getRepoRoot();
  if (!repoRoot || !isGitWorkTree(repoRoot)) fail("not a git repository (pass --repo <path>)");

  let config;
  try {
    config = readDriftConfig(repoRoot);
  } catch (error) {
    if (error instanceof ConfigError) fail(`config error: ${error.message}`);
    throw error;
  }
  if (!config) fail(INIT_GUIDANCE);

  const result = checkRepo(repoRoot, config);
  console.log(json ? JSON.stringify(result, null, 2) : formatTable(result));
  process.exit(result.findings.length > 0 ? 1 : 0);
}

// Run only when invoked directly (realpath both sides so a symlinked path still runs).
function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(SELF);
  } catch {
    return false;
  }
}

if (invokedDirectly()) main();
