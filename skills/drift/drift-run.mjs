#!/usr/bin/env node
/**
 * drift helper: run state + report delivery. The deterministic half of the
 * skill flow, so the agent spends tokens on triage, not bookkeeping.
 *
 *   state   resolve gh, the tracking issue, the trusted watermark, and the
 *           git-log window for the LLM pass. upToDate: true means stop now.
 *   report  take the agent's confirmed findings (JSON file), compute IDs from
 *           the verbatim doc lines, split new vs still-open against prior
 *           trusted comments, append ONE comment to the tracking issue
 *           (creating it on first run), then at most one notify POST.
 *           No gh: write the report to stdout + a temp file instead.
 *
 * Usage:
 *   node drift-run.mjs state  [--repo <path>] [--since "7 days ago"]
 *   node drift-run.mjs report --findings <file.json> [--repo <path>] [--since ...]
 *
 * Findings file: [{ "doc": "CLAUDE.md", "line": 48, "claim": "paths", "evidence": "..." }]
 * Exit codes: 0 ok (including the up-to-date skip), 2 error.
 * Dependency-free. Resolves its own paths.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ConfigError,
  getRepoRoot,
  isGitWorkTree,
  readDriftConfig,
} from "../slynk-mjs-utils/spec-config.mjs";
import { findingId, runSelfTest } from "./drift-check.mjs";

const WATERMARK_LINE = /^Scanned through: ([0-9a-f]{7,40})$/;
// Only the ID column (table row or open-list bullet), never a hex span inside a quote.
const FINDING_ID_TOKEN = /^(?:\| |- )`([0-9a-f]{8})`/gm;
const DEFAULT_SINCE = "7 days ago";
const ISSUE_TITLE = "Doc drift tracking";
const NO_GH_NOTICE = "no gh: watermark and tracking issue skipped";

const git = (repoRoot, args) => spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });

/**
 * Comments whose author is the authenticated gh login AND whose last line is a
 * `Scanned through:` watermark. Everything else is ignored for watermark and
 * dedupe, so a stranger's comment can't steer the run. Order is preserved.
 */
export function trustedComments(comments, login) {
  const trusted = [];
  for (const comment of comments) {
    if (!login || comment.author !== login) continue;
    const lastLine = comment.body.trimEnd().split(/\r?\n/).at(-1) ?? "";
    const match = lastLine.trim().match(WATERMARK_LINE);
    if (match) trusted.push({ body: comment.body, sha: match[1] });
  }
  return trusted;
}

function collectIds(bodies) {
  const ids = new Set();
  for (const body of bodies) for (const match of body.matchAll(FINDING_ID_TOKEN)) ids.add(match[1]);
  return ids;
}

// A watermark that doesn't resolve or isn't an ancestor of HEAD (force-push, a
// stray hex match) is treated as absent; the note lands in the run comment.
function resolveWatermark(repoRoot, sha) {
  if (!sha) return { watermark: null, fallbackNote: null };
  const full = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]).stdout.trim();
  if (full && git(repoRoot, ["merge-base", "--is-ancestor", full, "HEAD"]).status === 0) {
    return { watermark: full, fallbackNote: null };
  }
  return {
    watermark: null,
    fallbackNote: `Watermark ${sha} is missing or not an ancestor of HEAD; scanned the --since window instead.`,
  };
}

function ghReady(gh) {
  return gh(["--version"]).status === 0 && gh(["auth", "status"]).status === 0;
}

// A gh read that fails must stop the run: treating it as empty data would lose
// the watermark, repost every finding as new, or file a duplicate tracking issue.
function ghRead(gh, args, what) {
  const result = gh(args);
  if (result.status !== 0) throw new Error(`gh ${what} failed: ${result.stderr ?? ""}`.trim());
  return result.stdout;
}

function ghJson(gh, args, what) {
  try {
    return JSON.parse(ghRead(gh, args, what));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`gh ${what} returned invalid JSON`);
    throw error;
  }
}

/** Everything the skill needs before the LLM pass. Read-only. */
export function gatherState({ repoRoot, gh, since = DEFAULT_SINCE }) {
  const config = readDriftConfig(repoRoot);
  if (!config) throw new ConfigError("no drift: section in .slynk.yml; run slynk-drift init");
  const head = git(repoRoot, ["rev-parse", "HEAD"]).stdout.trim();
  if (!head) throw new Error("could not resolve HEAD (empty repo or not a git work tree)");
  const windowArgs = (watermark) =>
    watermark ? ["log", "--stat", `${watermark}..HEAD`] : ["log", "--stat", `--since=${since}`];

  if (!ghReady(gh)) {
    return {
      gh: false,
      notice: NO_GH_NOTICE,
      config,
      head,
      login: null,
      issue: null,
      trusted: [],
      watermark: null,
      fallbackNote: null,
      upToDate: false,
      logArgs: windowArgs(null),
    };
  }

  const login = ghRead(gh, ["api", "user", "--jq", ".login"], "api user").trim();
  if (!login) throw new Error("gh api user returned no login");
  const issues = ghJson(
    gh,
    [
      "issue",
      "list",
      "--label",
      config.label,
      "--state",
      "open",
      "--json",
      "number",
      "--limit",
      "1",
    ],
    "issue list",
  );
  const issue = issues[0]?.number ?? null;
  const comments = issue
    ? (ghJson(gh, ["issue", "view", String(issue), "--json", "comments"], "issue view").comments ??
      [])
    : [];
  const trusted = trustedComments(
    comments.map((comment) => ({ author: comment.author?.login, body: comment.body ?? "" })),
    login,
  );
  const { watermark, fallbackNote } = resolveWatermark(repoRoot, trusted.at(-1)?.sha);

  return {
    gh: true,
    notice: null,
    config,
    head,
    login,
    issue,
    trusted,
    watermark,
    fallbackNote,
    upToDate: watermark !== null && watermark === head,
    logArgs: windowArgs(watermark),
  };
}

// Inline code that survives any backticks in the quote and can't break a table.
function codeSpan(text) {
  const flat = String(text).replaceAll(/\s+/g, " ").trim();
  const clipped = flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
  const longestRun = Math.max(0, ...(clipped.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const pad = clipped.startsWith("`") || clipped.endsWith("`") || longestRun > 0 ? " " : "";
  return `${fence}${pad}${clipped}${pad}${fence}`.replaceAll("|", String.raw`\|`);
}

function findingsTable(findings) {
  const rows = findings.map(
    (finding) =>
      `| \`${finding.id}\` | ${finding.doc}:${finding.line} | ${finding.claim}: ${codeSpan(finding.text.trim())} | ${codeSpan(finding.evidence ?? "")} |`,
  );
  return ["| ID | Doc | Claim | Evidence |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

const openList = (findings) =>
  findings
    .map((finding) => `- \`${finding.id}\` ${finding.doc}:${finding.line} (${finding.claim})`)
    .join("\n");

function formatComment({ fresh, open, resolved, head, notes, unsplit }) {
  const blocks = [];
  if (fresh.length === 0 && open.length === 0) {
    blocks.push("Self-test OK. No drift found.");
  } else {
    blocks.push("Self-test OK.");
    if (unsplit) {
      blocks.push(`**Findings** (${fresh.length}, dedupe unavailable)`, findingsTable(fresh));
    } else {
      if (fresh.length > 0) blocks.push(`**New** (${fresh.length})`, findingsTable(fresh));
      if (open.length > 0) blocks.push(`**Still open** (${open.length})`, openList(open));
    }
  }
  if (resolved > 0) blocks.push(`Resolved since last run: ${resolved}`);
  blocks.push(...notes.filter(Boolean), `Scanned through: ${head}`);
  return `${blocks.join("\n\n")}\n`;
}

// Attach the verbatim doc line + stable ID to each agent-confirmed finding.
// The findings file is agent-written, so `doc` must be a manifest doc: the
// quoted line lands in a public comment, and an injected path would leak it.
function resolveFindings(repoRoot, config, findings) {
  const allowed = new Set(config.docs.map((entry) => path.posix.normalize(entry.path)));
  const byId = new Map();
  for (const finding of findings) {
    if (typeof finding.doc !== "string" || !allowed.has(path.posix.normalize(finding.doc))) {
      throw new Error(`finding doc "${finding.doc}" is not a manifest doc`);
    }
    if (!Number.isInteger(finding.line) || finding.line < 1) {
      throw new Error(`${finding.doc}: line must be a positive integer, got ${finding.line}`);
    }
    const lines = readFileSync(path.join(repoRoot, finding.doc), "utf8").split(/\r?\n/);
    const text = lines[finding.line - 1];
    if (text === undefined)
      throw new Error(`${finding.doc}:${finding.line} is past the end of the file`);
    const id = findingId(finding.doc, text);
    if (!byId.has(id)) byId.set(id, { ...finding, id, text });
  }
  return [...byId.values()];
}

function repoName(repoRoot, gh) {
  const name = gh(["repo", "view", "--json", "name", "--jq", ".name"]).stdout?.trim();
  return name || path.basename(repoRoot);
}

function createIssue(gh, label) {
  const body =
    "Rolling report for slynk-drift. One comment per run; each comment's last line is its watermark.";
  const created = gh(["issue", "create", "--title", ISSUE_TITLE, "--label", label, "--body", body]);
  const number = created.stdout?.match(/\/issues\/(\d+)/)?.[1];
  if (created.status !== 0 || !number) {
    throw new Error(
      `could not create the tracking issue (does label "${label}" exist?): ${created.stderr ?? ""}`.trim(),
    );
  }
  return Number(number);
}

/**
 * Deliver one run's report. Outward actions: one issue comment (plus issue
 * creation on first run) and at most one notify POST. Nothing on an
 * up-to-date skip or a failed self-test.
 */
export async function deliverReport({ repoRoot, gh, fetchImpl = fetch, findings, since }) {
  const state = gatherState({ repoRoot, gh, since });
  if (state.upToDate) return { skipped: "up to date: HEAD already scanned" };

  const selfTest = runSelfTest();
  if (!selfTest.ok) return { error: selfTest.line };

  const resolvedFindings = resolveFindings(repoRoot, state.config, findings);

  if (!state.gh) {
    const body = formatComment({
      fresh: resolvedFindings,
      open: [],
      resolved: 0,
      head: state.head,
      notes: [`${NO_GH_NOTICE}.`],
      unsplit: true,
    });
    const file = path.join(
      mkdtempSync(path.join(tmpdir(), "slynk-drift-report-")),
      "drift-report.md",
    );
    writeFileSync(file, body);
    return {
      notice: NO_GH_NOTICE,
      body,
      file,
      counts: { new: resolvedFindings.length, open: 0, resolved: 0 },
    };
  }

  const prior = collectIds(state.trusted.map((comment) => comment.body));
  const last = collectIds([state.trusted.at(-1)?.body ?? ""]);
  const current = new Set(resolvedFindings.map((finding) => finding.id));
  const fresh = resolvedFindings.filter((finding) => !prior.has(finding.id));
  const open = resolvedFindings.filter((finding) => prior.has(finding.id));
  const resolved = [...last].filter((id) => !current.has(id)).length;

  const body = formatComment({
    fresh,
    open,
    resolved,
    head: state.head,
    notes: [state.fallbackNote],
    unsplit: false,
  });
  const issue = state.issue ?? createIssue(gh, state.config.label);
  const posted = gh(["issue", "comment", String(issue), "--body-file", "-"], { input: body });
  if (posted.status !== 0)
    throw new Error(`gh issue comment failed: ${posted.stderr ?? ""}`.trim());

  const counts = { new: fresh.length, open: open.length, resolved };
  let notified = false;
  if (state.config.notify) {
    const message = `drift: ${counts.new} new, ${counts.open} open (${repoName(repoRoot, gh)})`;
    try {
      const response = await fetchImpl(state.config.notify, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: message,
      });
      notified = response.ok;
    } catch {
      notified = false;
    }
  }
  return { issue, body, counts, notified };
}

// --- CLI -----------------------------------------------------------------------

function realGh(repoRoot) {
  return (args, options = {}) => {
    const result = spawnSync("gh", args, {
      cwd: repoRoot,
      encoding: "utf8",
      input: options.input,
    });
    return result.error ? { status: 127, stdout: "", stderr: String(result.error) } : result;
  };
}

function fail(message) {
  console.log(JSON.stringify({ error: message }));
  process.exit(2);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
  };

  if (spawnSync("git", ["--version"]).error) fail("git not found: slynk-drift needs git");
  const repoRoot = getRepoRoot();
  if (!repoRoot || !isGitWorkTree(repoRoot)) fail("not a git repository (pass --repo <path>)");
  const gh = realGh(repoRoot);
  const since = flag("since");

  try {
    if (args[0] === "state") {
      const { config, trusted, ...state } = gatherState({ repoRoot, gh, since });
      console.log(
        JSON.stringify(
          {
            ...state,
            label: config.label,
            notify: Boolean(config.notify),
            priorRuns: trusted.length,
          },
          null,
          2,
        ),
      );
      return;
    }
    if (args[0] === "report") {
      const findingsFile = flag("findings");
      if (!findingsFile) fail("report needs --findings <file.json>");
      const findings = JSON.parse(readFileSync(path.resolve(findingsFile), "utf8"));
      if (!Array.isArray(findings)) fail("findings file must hold a JSON array");
      const result = await deliverReport({ repoRoot, gh, findings, since });
      if (result.error) fail(result.error);
      if (result.file) {
        console.error(result.notice);
        console.log(result.body);
      }
      console.log(JSON.stringify({ ...result, body: undefined }, null, 2));
      return;
    }
    fail("usage: drift-run.mjs state|report [--findings <file>] [--repo <path>] [--since <when>]");
  } catch (error) {
    fail(error.message);
  }
}

function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(import.meta.filename);
  } catch {
    return false;
  }
}

if (invokedDirectly()) await main();
