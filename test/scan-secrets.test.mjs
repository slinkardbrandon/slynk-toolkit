import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  scanSecrets,
  addedLines,
  parseGitleaksReport,
  GITLEAKS_FINDINGS_EXIT,
} from "../skills/create-pr/scan-secrets.mjs";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../skills/create-pr/scan-secrets.mjs",
);

const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

const runScript = (scriptPath, repoPath, base = "main") =>
  spawnSync(process.execPath, [scriptPath, "--base", base, "--repo", repoPath], {
    encoding: "utf8",
  });

/** A throwaway repo with one commit on main and `files` added on a branch. */
function withBranch(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "scan-secrets-"));
  try {
    git(dir, "init", "-q", "-b", "main");
    git(dir, "config", "user.email", "test@example.com");
    git(dir, "config", "user.name", "Test");
    writeFileSync(join(dir, "README.md"), "# base\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    git(dir, "checkout", "-qb", "feature");

    for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents);

    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "work", "--allow-empty");

    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Split so the literal never appears in this file and trips a scanner.
const AWS_KEY = `${"AKIA"}${"ABCDEFGHIJKLMNOP"}`;

describe("scanSecrets", () => {
  it("scans a clean diff clean, naming the engine", () => {
    const result = withBranch({ "app.mjs": "export const x = 1;\n" }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir }),
    );

    expect(result.clean).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.findings).toEqual([]);
    expect(["gitleaks", "grep"]).toContain(result.engine);
  });

  it("blocks on a real credential in the diff", () => {
    const result = withBranch({ "config.mjs": `const key = "${AWS_KEY}";\n` }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir }),
    );

    expect(result.clean).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("blocks instead of passing when the base is unusable", () => {
    const missingBase = withBranch({ "a.mjs": "x\n" }, (dir) =>
      scanSecrets({ base: "origin/does-not-exist", repoPath: dir }),
    );
    expect(missingBase.clean).toBe(false);
    expect(missingBase.blocking).toBe(true);
    expect(missingBase.coverage).toBe("none");
    expect(missingBase.note).toMatch(/git diff .* failed/);

    const noBase = scanSecrets({ base: null });
    expect(noBase.blocking).toBe(true);
    expect(noBase.note).toMatch(/No base branch/);
  });

  it("calls an empty diff clean without pretending to have scanned", () => {
    const result = withBranch({}, (dir) => scanSecrets({ base: "main", repoPath: dir }));
    expect(result.clean).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.note).toMatch(/Empty diff/);
  });
});

// The whole reason this helper exists.
describe("a missing scanner", () => {
  it("is never reported as clean", () => {
    // `git diff | gitleaks` exits 127 with empty stdout when gitleaks is
    // absent, indistinguishable from a clean run if you only read stdout. The
    // fallback must announce degraded coverage rather than imply a pass.
    const result = withBranch({ "app.mjs": "export const x = 1;\n" }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir, gitleaksAvailable: false }),
    );

    expect(result.engine).toBe("grep");
    expect(result.available).toBe(false);
    expect(result.coverage).toBe("partial");
    expect(result.note).toMatch(/gitleaks is not installed/);
  });

  it("still catches the obvious ones", () => {
    const result = withBranch({ "config.mjs": `const key = "${AWS_KEY}";\n` }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir, gitleaksAvailable: false }),
    );

    expect(result.engine).toBe("grep");
    expect(result.blocking).toBe(true);
    expect(result.findings[0].rule).toBe("AWS access key id");
  });

  it("catches a short password but not a short token", () => {
    // Per-type thresholds: a weak 6-char password is still a leaked password,
    // while a 6-char "token" is almost always a variable name.
    const result = withBranch(
      {
        "a.mjs": 'const password = "hunt3r";\n',
        "b.mjs": 'const token = "abcdef";\n',
      },
      (dir) => scanSecrets({ base: "main", repoPath: dir, gitleaksAvailable: false }),
    );

    expect(result.findings.map((f) => f.rule)).toEqual(["assigned password"]);
  });

  it("scans only added lines -- removing a secret is the fix", () => {
    expect(addedLines("+++ b/a.mjs\n+const a = 1;\n-const b = 2;\n context\n")).toEqual([
      "const a = 1;",
    ]);
  });
});

// The CLI entry point, which every other test bypasses by importing the module.
// A guard regression is invisible to all of them.
describe("running the script (not importing it)", () => {
  it("prints a result when invoked by its real path", () => {
    const out = withBranch({ "app.mjs": "export const x = 1;\n" }, (dir) => runScript(SCRIPT, dir));

    expect(out.stdout.trim()).not.toBe("");
    expect(JSON.parse(out.stdout)).toHaveProperty("coverage");
  });

  it("still prints a result when invoked through a symlink", () => {
    // The guard compares argv[1] against import.meta.filename. Compared
    // lexically, any symlinked component makes those differ, so the script
    // exits 0 having printed nothing -- a silent pass, the exact failure this
    // file exists to prevent. Agents install skills as symlinks, so this is a
    // real invocation path, not a hypothetical.
    const linkDir = mkdtempSync(join(tmpdir(), "scan-secrets-link-"));
    try {
      const link = join(linkDir, "scan-secrets.mjs");
      symlinkSync(SCRIPT, link);

      const out = withBranch({ "app.mjs": "export const x = 1;\n" }, (dir) => runScript(link, dir));

      expect(out.stdout.trim()).not.toBe("");
      expect(JSON.parse(out.stdout)).toHaveProperty("coverage");
    } finally {
      rmSync(linkDir, { recursive: true, force: true });
    }
  });

  it("exits 2, never 0, when it could not scan", () => {
    const out = withBranch({ "app.mjs": "x\n" }, (dir) =>
      runScript(SCRIPT, dir, "origin/does-not-exist"),
    );

    expect(out.status).toBe(2);
  });
});

// An unreadable report is not an empty findings list.
describe("parseGitleaksReport", () => {
  it("treats a missing or empty report as a failure, not a pass", () => {
    for (const status of [0, GITLEAKS_FINDINGS_EXIT]) {
      for (const report of [null, "   "]) {
        const parsed = parseGitleaksReport({ status, report });
        expect(parsed.findings).toBeUndefined();
        expect(parsed.failure).toMatch(/not a clean scan|findings are unknown/);
      }
    }
  });

  it("treats a malformed report as a failure, not a pass", () => {
    expect(parseGitleaksReport({ status: 0, report: "{ nope" }).failure).toMatch(/not valid JSON/);
    expect(
      parseGitleaksReport({ status: GITLEAKS_FINDINGS_EXIT, report: '"a string"' }).failure,
    ).toMatch(/expected an array/);
  });

  it("treats a findings exit with an empty report as a failure", () => {
    const parsed = parseGitleaksReport({ status: GITLEAKS_FINDINGS_EXIT, report: "[]" });
    expect(parsed.findings).toBeUndefined();
    expect(parsed.failure).toMatch(/contradictory/);
  });

  it("parses a real report into findings", () => {
    const report = parseGitleaksReport({
      status: GITLEAKS_FINDINGS_EXIT,
      report: JSON.stringify([{ RuleID: "aws-access-token", Match: AWS_KEY, StartLine: 4 }]),
    });

    expect(report.failure).toBeUndefined();
    expect(report.findings).toEqual([
      { rule: "aws-access-token", secret: "AKIAABCDEFGH...", line: 4 },
    ]);
    expect(parseGitleaksReport({ status: 0, report: "[]" }).findings).toEqual([]);
  });
});

// Regression: gitleaks was told to write its report to /dev/stdout. Under
// spawnSync, stdout is a socket on Linux, opening /dev/stdout on it fails, and
// gitleaks exited 1 before scanning, so every clean branch read as "findings
// unknown". From a shell it worked, which is how it shipped. These run the
// real spawnSync path against the installed binary, no mocks.
const HAS_GITLEAKS = spawnSync("gitleaks", ["version"]).status === 0;
if (!HAS_GITLEAKS) {
  console.warn("Skipping real-gitleaks tests: gitleaks is not installed on this machine.");
}

describe.skipIf(!HAS_GITLEAKS)("real gitleaks through spawnSync (needs gitleaks installed)", () => {
  it("scans a clean diff clean with full coverage", () => {
    const result = withBranch({ "app.mjs": "export const x = 1;\n" }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir, gitleaksAvailable: true }),
    );

    expect(result).toMatchObject({
      engine: "gitleaks",
      clean: true,
      blocking: false,
      coverage: "full",
      findings: [],
    });
  });

  it("reports findings for a diff with an obvious fake secret", () => {
    const result = withBranch({ "config.mjs": `const key = "${AWS_KEY}";\n` }, (dir) =>
      scanSecrets({ base: "main", repoPath: dir, gitleaksAvailable: true }),
    );

    expect(result.engine).toBe("gitleaks");
    expect(result.coverage).toBe("full");
    expect(result.blocking).toBe(true);
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
