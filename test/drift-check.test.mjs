import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractSpans,
  extractLinks,
  githubSlugs,
  parseScriptName,
  checkRepo,
  findingId,
} from "../skills/drift/drift-check.mjs";
import { readDriftConfig } from "../skills/slynk-mjs-utils/spec-config.mjs";

const SCRIPT = fileURLToPath(new URL("../skills/drift/drift-check.mjs", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../skills/drift/fixtures/self-test", import.meta.url));

const git = (dir, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: dir,
    encoding: "utf8",
  });

const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

const temporaryDirectories = [];
afterEach(() => {
  while (temporaryDirectories.length > 0)
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

function write(dir, files) {
  for (const [name, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), contents);
  }
}

/** A throwaway repo with `files` committed. */
function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), "drift-check-"));
  temporaryDirectories.push(dir);
  git(dir, "init", "-q");
  write(dir, files);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}

function commit(dir, files, message = "change") {
  write(dir, files);
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", message);
}

const manifest = (docEntry = "") =>
  `drift:\n  docs:\n    - path: README.md\n      sources: ["src/"]\n${docEntry}`;

const check = (repo) => checkRepo(repo, readDriftConfig(repo));
const factFindings = (repo) => check(repo).findings.filter((f) => f.claim !== "recency");

describe("extraction", () => {
  it("extracts inline code spans only, never prose or fenced blocks", () => {
    const md = "Use `src/a.js` here.\n\n```bash\ncat `src/b.js`\n```\n\n~~~\nsrc/c.js\n~~~\n`x/y`";
    expect(extractSpans(md)).toEqual([
      { line: 1, text: "src/a.js" },
      { line: 10, text: "x/y" },
    ]);
  });

  it("handles double-backtick spans", () => {
    expect(extractSpans("a `` b`c `` d")).toEqual([{ line: 1, text: "b`c" }]);
  });

  it("extracts link targets outside code spans and fences", () => {
    const md = "[a](docs/a.md#x) `[b](nope.md)`\n```\n[c](fenced.md)\n```\n[ref]: docs/r.md";
    expect(extractLinks(md).map((link) => link.target)).toEqual(["docs/a.md#x", "docs/r.md"]);
  });

  it("slugs headings GitHub-style with duplicate suffixes", () => {
    const slugs = githubSlugs(
      "# Hello, World!\n## Hello, World!\n## `code` & Stuff\n```\n# no\n```",
    );
    expect([...slugs]).toEqual(["hello-world", "hello-world-1", "code--stuff"]);
  });

  it("parses only `pnpm run` / `npm run` script names, ignoring trailing args", () => {
    expect(parseScriptName("pnpm run e2e -- --clean")).toBe("e2e");
    expect(parseScriptName("npm run lint:fix")).toBe("lint:fix");
    expect(parseScriptName("pnpm turbo run check-types build")).toBeNull();
    expect(parseScriptName("pnpm dev")).toBeNull();
  });

  it("finding IDs hash doc path + verbatim line and are stable", () => {
    const id = findingId("CLAUDE.md", "- `packages/env` validates env");
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(findingId("CLAUDE.md", "- `packages/env` validates env")).toBe(id);
    expect(findingId("README.md", "- `packages/env` validates env")).not.toBe(id);
  });
});

describe("fact assertions", () => {
  it("flags a dead path with file + line evidence, passes a live one", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": "# R\n\nLive `src/index.js`.\nDead `src/gone.js`.\n",
      "src/index.js": "",
    });
    const findings = factFindings(repo);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      doc: "README.md",
      line: 4,
      claim: "paths",
      token: "src/gone.js",
      text: "Dead `src/gone.js`.",
    });
    expect(findings[0].id).toBe(findingId("README.md", "Dead `src/gone.js`."));
  });

  it("flags a removed package script, passes an existing workspace script", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": "Run `pnpm run e2e -- --clean` and `npm run gone`.\n",
      "package.json": '{"scripts":{"build":"x"}}',
      "apps/web/package.json": '{"scripts":{"e2e":"x"}}',
      "src/index.js": "",
    });
    const findings = factFindings(repo);
    expect(findings.map((f) => [f.claim, f.token])).toEqual([["scripts", "gone"]]);
  });

  it("skips ambiguous span classes and suppresses ignore tokens", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest("      ignore: [src/ignored.js]\n"),
      ".gitignore": "apps/web/cypress/results/\n",
      "README.md": [
        "`jobs/*` `00NN_*.sql` `pnpm turbo run check-types build` `@sentry/node`",
        "`feat/issue-N` `i18next/no-literal-string` `cypress/e2e/stripe/`",
        "`apps/web/cypress/results/last-run.json` `packages/db` `apps/web/`",
        "`src/ignored.js`",
        "```",
        "cat `cypress/e2e/foo.cy.ts`",
        "```",
      ].join("\n"),
      "jobs/a/x.ts": "",
      "packages/db/src/schema/x.ts": "",
      "apps/web/cypress/e2e/stripe/x.cy.ts": "",
      "src/index.js": "",
    });
    expect(factFindings(repo)).toEqual([]);
  });

  it("fails a tracked-dir path whose file was renamed", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": "See `src/old-name.js`.\n",
      "src/new-name.js": "",
    });
    expect(factFindings(repo).map((f) => f.token)).toEqual(["src/old-name.js"]);
  });

  it("checks repo-internal links and anchors, skipping external URLs", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": [
        "# Top",
        "[ok](docs/guide.md#setup) [bad-anchor](docs/guide.md#nope) [dead](docs/gone.md)",
        "[self](#top) [self-bad](#missing) [ext](https://example.com/x#y)",
      ].join("\n"),
      "docs/guide.md": "# Guide\n\n## Setup\n",
      "src/index.js": "",
    });
    expect(factFindings(repo).map((f) => f.token)).toEqual([
      "docs/guide.md#nope",
      "docs/gone.md",
      "#missing",
    ]);
  });

  it("narrows to the listed claim classes", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest("      claims: [scripts]\n"),
      "README.md": "Dead `src/gone.js` [dead](gone.md)\n",
      "src/index.js": "",
    });
    expect(factFindings(repo)).toEqual([]);
  });
});

describe("git recency", () => {
  it("flags a doc older than its mapped sources; quiet when the doc is newer", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": "# R\n",
      "src/index.js": "",
    });
    expect(check(repo).findings).toEqual([]);

    commit(repo, { "src/index.js": "changed" }, "touch source");
    const recency = check(repo).findings.filter((f) => f.claim === "recency");
    expect(recency).toHaveLength(1);
    expect(recency[0]).toMatchObject({ doc: "README.md", sourceSubject: "touch source" });

    commit(repo, { "README.md": "# R\n\nupdated\n" }, "touch doc");
    expect(check(repo).findings).toEqual([]);
  });
});

describe("CLI", () => {
  it("exits 0 clean, 1 with findings, JSON on --json", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest(),
      "README.md": "`src/index.js`\n",
      "src/index.js": "",
    });
    const clean = run(["--repo", repo, "--json"]);
    expect(clean.status).toBe(0);
    expect(JSON.parse(clean.stdout).findings).toEqual([]);

    commit(repo, { "README.md": "`src/gone.js`\n" });
    const dirty = run(["--repo", repo, "--json"]);
    expect(dirty.status).toBe(1);
    expect(JSON.parse(dirty.stdout).findings[0].token).toBe("src/gone.js");
  });

  it("exits 2 on a config error", () => {
    const repo = makeRepo({
      ".slynk.yml": manifest("      claims: [paths]\n      recency_only: true\n"),
      "README.md": "",
    });
    expect(run(["--repo", repo, "--json"]).status).toBe(2);
  });

  it("exits 2 with init guidance when drift: is missing", () => {
    const repo = makeRepo({ "README.md": "" });
    const result = run(["--repo", repo, "--json"]);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout).error).toMatch(/slynk-drift init/);
  });
});

describe("--self-test (positive control)", () => {
  it("exits 0 on the intact bundled fixture", () => {
    const result = run(["--self-test"]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Self-test OK/);
  });

  it("fails closed when a plant is no longer detected", () => {
    const sabotaged = mkdtempSync(join(tmpdir(), "drift-sabotage-"));
    temporaryDirectories.push(sabotaged);
    cpSync(FIXTURE, sabotaged, { recursive: true });
    // "Fix" the planted dead path so the checker can no longer find it.
    writeFileSync(join(sabotaged, "src", "removed.js"), "");
    const result = run(["--self-test", "--fixture", sabotaged]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toMatch(/Self-test FAILED/);
  });
});
