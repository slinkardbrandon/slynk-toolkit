#!/usr/bin/env node
/**
 * create-pr helper: secret scan for a branch diff, with an honest failure mode.
 *
 * The bug this exists to kill: `git diff | gitleaks detect --pipe` exits 127
 * with empty stdout when gitleaks is not installed, which looks exactly like a
 * clean scan. A control that silently no-ops is worse than no control, because
 * people trust it. Every result here names the engine that produced it, and
 * `clean` is only ever true when something actually scanned.
 *
 * Usage: node scan-secrets.mjs --base origin/main [--head HEAD] [--repo /path]
 *
 * Prints one JSON object:
 *   { engine, available, clean, blocking, findings[], coverage, note }
 *
 * Exit codes: 0 clean, 1 findings, 2 could not scan (never confuse with 0).
 * Dependency-free. Resolves its own paths.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Exit code we ask gitleaks to use for "leaks found". Its default is 1, which
 * is also what it exits on a fatal error, so 1 alone can't tell "found a
 * secret" from "never scanned". 99 is unused by gitleaks itself.
 */
const GITLEAKS_FINDINGS_EXIT = 99;

/**
 * Fallback patterns, used only when gitleaks is absent. Deliberately few and
 * high-confidence: this is a smoke alarm, not a replacement for gitleaks' rule
 * set, and the output says so.
 *
 * Thresholds are per-type on purpose. A weak 6-character password is still a
 * leaked password, while a 6-character "token" is almost always a variable
 * name, so the noisier keys demand more length before they fire.
 */
const FALLBACK_PATTERNS = [
  { name: "AWS access key id", pattern: /\bAKIA[\dA-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh[oprsu]_[\dA-Za-z]{20,}\b/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "assigned password",
    pattern: /\b(?:password|secret)\s*[:=]\s*["'][^"']{6,}["']/i,
  },
  {
    name: "assigned api key",
    pattern: /\b(?:api[_-]?key|token)\s*[:=]\s*["'][^"']{10,}["']/i,
  },
];

function parseArguments(argv) {
  const args = argv.slice(2);
  const flag = (name, fallback = null) => {
    const position = args.indexOf(`--${name}`);
    return position !== -1 && args[position + 1] ? args[position + 1] : fallback;
  };
  return {
    base: flag("base"),
    head: flag("head", "HEAD"),
    repoPath: resolve(flag("repo", process.cwd())),
  };
}

function run(command, commandArguments, options = {}) {
  return spawnSync(command, commandArguments, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function hasGitleaks() {
  return run("gitleaks", ["version"]).status === 0;
}

/** Only added lines can introduce a secret; a removal is the fix, not the leak. */
export function addedLines(diff) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

/** A gitleaks run we cannot trust. Never clean, never an empty findings list. */
function gitleaksFailed(note) {
  return {
    engine: "gitleaks",
    available: true,
    clean: false,
    blocking: true,
    findings: [],
    coverage: "none",
    note,
  };
}

/**
 * Returns `{ findings }` only for a report we actually read, `{ failure }`
 * otherwise. That distinction is the whole point of this file: defaulting
 * unreadable output to `[]` is how a broken scanner reports a clean branch.
 *
 * `report` is the report file's contents, or null when it could not be read.
 */
export function parseGitleaksReport({ status, report }) {
  const raw = (report ?? "").trim();

  if (!raw) {
    return {
      failure:
        status === GITLEAKS_FINDINGS_EXIT
          ? `gitleaks exited ${GITLEAKS_FINDINGS_EXIT} (it found something) but the report was empty or missing, so the findings are unknown.`
          : `gitleaks exited ${status} but the report was empty or missing, so nothing was verified. This is not a clean scan.`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      failure: `gitleaks report was not valid JSON, so its findings could not be read (exit ${status}).`,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      failure: `gitleaks report was ${typeof parsed}, expected an array of findings (exit ${status}).`,
    };
  }

  // Exit says findings, report says none: one of them is wrong, so trust neither.
  if (status === GITLEAKS_FINDINGS_EXIT && parsed.length === 0) {
    return {
      failure: `gitleaks exited ${GITLEAKS_FINDINGS_EXIT} (it found something) but reported no findings, so the result is contradictory.`,
    };
  }

  return {
    findings: parsed.map((finding) => ({
      rule: finding.RuleID || finding.Description || "unknown",
      secret: finding.Match ? `${finding.Match.slice(0, 12)}...` : null,
      line: finding.StartLine ?? null,
    })),
  };
}

function readReport(reportPath) {
  try {
    return readFileSync(reportPath, "utf8");
  } catch {
    return null;
  }
}

/**
 * The report goes to a temp file, never /dev/stdout. Under spawnSync the
 * child's stdout is a socket on Linux, opening /dev/stdout on a socket fails
 * (ENXIO), and gitleaks dies with exit 1 before scanning anything.
 */
function scanWithGitleaks(diff, repoPath) {
  const reportDir = mkdtempSync(join(tmpdir(), "slynk-gitleaks-"));
  const reportPath = join(reportDir, "report.json");

  try {
    const result = run(
      "gitleaks",
      [
        "detect",
        "--pipe",
        "--no-banner",
        "--report-format",
        "json",
        "--report-path",
        reportPath,
        "--exit-code",
        String(GITLEAKS_FINDINGS_EXIT),
      ],
      { cwd: repoPath, input: diff },
    );

    // 0 = clean, GITLEAKS_FINDINGS_EXIT = findings. Anything else (including
    // 1, a fatal error) means gitleaks itself failed and must not read as clean.
    if (result.status !== 0 && result.status !== GITLEAKS_FINDINGS_EXIT) {
      return gitleaksFailed(
        `gitleaks exited ${result.status}: ${(result.stderr || "").trim() || "no stderr"}`,
      );
    }

    const report = parseGitleaksReport({ status: result.status, report: readReport(reportPath) });
    if (report.failure) return gitleaksFailed(report.failure);

    return {
      engine: "gitleaks",
      available: true,
      clean: report.findings.length === 0,
      blocking: report.findings.length > 0,
      findings: report.findings,
      coverage: "full",
      note: null,
    };
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}

function scanWithFallback(diff) {
  const findings = [];
  for (const line of addedLines(diff)) {
    for (const { name, pattern } of FALLBACK_PATTERNS) {
      if (pattern.test(line)) findings.push({ rule: name, secret: null, line: null });
    }
  }

  return {
    engine: "grep",
    available: false,
    clean: findings.length === 0,
    blocking: findings.length > 0,
    findings,
    // The whole point: a clean fallback result is NOT a clean scan. Say so, so
    // the skill reports partial coverage instead of "no secrets found".
    coverage: "partial",
    note: `gitleaks is not installed, so this was a ${FALLBACK_PATTERNS.length}-pattern smoke test, not a real scan. Install it (brew install gitleaks) for actual coverage.`,
  };
}

function cannotScan(note) {
  return {
    engine: "none",
    available: false,
    clean: false,
    blocking: true,
    findings: [],
    coverage: "none",
    note,
  };
}

export function scanSecrets({
  base,
  head = "HEAD",
  repoPath = process.cwd(),
  // Injectable so tests can exercise the missing-gitleaks path without hiding
  // git itself, which is what happens if you just blank PATH.
  gitleaksAvailable = null,
}) {
  if (!base) return cannotScan("No base branch given, so there is no diff to scan.");

  const diff = run("git", ["diff", `${base}...${head}`], { cwd: repoPath });
  if (diff.status !== 0) {
    return cannotScan(`git diff ${base}...${head} failed: ${(diff.stderr || "").trim()}`);
  }

  if (!diff.stdout.trim()) {
    return {
      engine: "none",
      available: true,
      clean: true,
      blocking: false,
      findings: [],
      coverage: "full",
      note: "Empty diff, nothing to scan.",
    };
  }

  const available = gitleaksAvailable ?? hasGitleaks();

  return available ? scanWithGitleaks(diff.stdout, repoPath) : scanWithFallback(diff.stdout);
}

export { FALLBACK_PATTERNS, GITLEAKS_FINDINGS_EXIT };

/**
 * Was this file run directly, rather than imported by a test?
 *
 * Both sides get realpath'd. `process.argv[1]` is the path the user typed, which
 * keeps every symlink in it; `import.meta.filename` is already resolved. Compare
 * them lexically and any symlinked component (an agent's skills dir, a symlinked
 * home, /tmp on macOS) makes them differ, the block below never runs, and the
 * script exits 0 having printed nothing -- the exact silent pass this file
 * exists to prevent. Resolving both also survives `--preserve-symlinks`.
 */
function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(import.meta.filename);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const result = scanSecrets(parseArguments(process.argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  // 2 is "could not scan" and must never be mistaken for 0.
  if (result.blocking) process.exitCode = result.findings.length > 0 ? 1 : 2;
}
