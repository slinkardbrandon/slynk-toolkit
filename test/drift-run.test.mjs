import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { gatherState, deliverReport, trustedComments } from "../skills/drift/drift-run.mjs";
import { findingId } from "../skills/drift/drift-check.mjs";

const git = (dir, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: dir,
    encoding: "utf8",
  }).trim();

const temporaryDirectories = [];
afterEach(() => {
  while (temporaryDirectories.length > 0)
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
});

const DOC = "# Readme\n\nSee `src/gone.js` for details.\n";

function makeRepo({ notify = "" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "drift-run-"));
  temporaryDirectories.push(dir);
  git(dir, "init", "-q");
  const files = {
    ".slynk.yml": `drift:\n${notify}  docs:\n    - path: README.md\n      sources: ["src/"]\n`,
    "README.md": DOC,
    "src/index.js": "",
  };
  for (const [name, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), contents);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "init");
  return dir;
}

const head = (repo) => git(repo, "rev-parse", "HEAD");

const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });

/**
 * A fake `gh` driven by an in-memory tracking issue. Records every call so a
 * test can assert exactly which outward actions happened.
 */
function fakeGh({
  login = "brandon",
  issue = null,
  comments = [],
  authed = true,
  failing = null,
} = {}) {
  const state = { issue, comments: [...comments], calls: [], created: null };
  state.gh = (args, options = {}) => {
    state.calls.push(args);
    const [command, sub] = args;
    if (failing && `${command} ${sub}` === failing)
      return { status: 1, stdout: "", stderr: "boom" };
    if (command === "--version") return ok("gh version 2");
    if (command === "auth") return authed ? ok() : { status: 1, stdout: "", stderr: "no" };
    if (command === "api" && sub === "user") return ok(`${login}\n`);
    if (command === "repo") return ok("suredocs\n");
    if (command === "issue" && sub === "list")
      return ok(JSON.stringify(state.issue ? [{ number: state.issue }] : []));
    if (command === "issue" && sub === "view")
      return ok(
        JSON.stringify({
          comments: state.comments.map((c) => ({ author: { login: c.author }, body: c.body })),
        }),
      );
    if (command === "issue" && sub === "create") {
      state.issue = 7;
      state.created = args;
      return ok("https://github.com/o/r/issues/7\n");
    }
    if (command === "issue" && sub === "comment") {
      state.comments.push({ author: login, body: options.input });
      return ok();
    }
    throw new Error(`unexpected gh call: ${args.join(" ")}`);
  };
  return state;
}

function fakeFetch() {
  const posts = [];
  const fetchImpl = async (url, init) => {
    posts.push({ url, ...init });
    return { ok: true, status: 200 };
  };
  return { posts, fetchImpl };
}

const finding = (repo) => [{ doc: "README.md", line: 3, claim: "paths", evidence: "not tracked" }];
const deadPathId = findingId("README.md", "See `src/gone.js` for details.");
const commentsOf = (fake) => fake.calls.filter((c) => c[0] === "issue" && c[1] === "comment");

describe("trusted comments", () => {
  it("ignores a Scanned through: comment from a non-authenticated author", () => {
    const trusted = trustedComments(
      [
        { author: "mallory", body: "lol\n\nScanned through: abcdef1" },
        { author: "brandon", body: "no watermark here" },
        { author: "brandon", body: "ok\n\nScanned through: 1234567\n" },
      ],
      "brandon",
    );
    expect(trusted.map((c) => c.sha)).toEqual(["1234567"]);
  });

  it("a spoofed watermark does not drive the early exit", () => {
    const repo = makeRepo();
    const fake = fakeGh({
      issue: 3,
      comments: [{ author: "mallory", body: `x\n\nScanned through: ${head(repo)}` }],
    });
    const state = gatherState({ repoRoot: repo, gh: fake.gh });
    expect(state.upToDate).toBe(false);
    expect(state.watermark).toBeNull();
  });
});

describe("watermark", () => {
  it("HEAD equal to the trusted watermark exits with no comment and no POST", async () => {
    const repo = makeRepo({ notify: "  notify: https://ntfy.sh/t\n" });
    const fake = fakeGh({
      issue: 3,
      comments: [{ author: "brandon", body: `ok\n\nScanned through: ${head(repo)}` }],
    });
    expect(gatherState({ repoRoot: repo, gh: fake.gh }).upToDate).toBe(true);

    const { posts, fetchImpl } = fakeFetch();
    const result = await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl,
      findings: finding(repo),
    });
    expect(result.skipped).toMatch(/up to date/);
    expect(commentsOf(fake)).toHaveLength(0);
    expect(posts).toHaveLength(0);
  });

  it("treats a non-ancestor watermark as absent and notes the fallback", async () => {
    const repo = makeRepo();
    const fake = fakeGh({
      issue: 3,
      comments: [{ author: "brandon", body: "ok\n\nScanned through: deadbeefdeadbeef" }],
    });
    const state = gatherState({ repoRoot: repo, gh: fake.gh });
    expect(state.watermark).toBeNull();
    expect(state.fallbackNote).toMatch(/not an ancestor/);
    expect(state.logArgs).toContain("--since=7 days ago");

    await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl: fakeFetch().fetchImpl,
      findings: [],
    });
    expect(fake.comments.at(-1).body).toMatch(/not an ancestor/);
  });

  it("bounds the log window at a valid watermark", () => {
    const repo = makeRepo();
    const base = head(repo);
    git(repo, "commit", "-q", "--allow-empty", "-m", "next");
    const fake = fakeGh({
      issue: 3,
      comments: [{ author: "brandon", body: `Scanned through: ${base}` }],
    });
    const state = gatherState({ repoRoot: repo, gh: fake.gh });
    expect(state.watermark).toBe(base);
    expect(state.logArgs).toContain(`${base}..HEAD`);
  });
});

describe("report", () => {
  it("clean run appends the clean-form comment and files nothing else", async () => {
    const repo = makeRepo();
    const fake = fakeGh({ issue: 3 });
    await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl: fakeFetch().fetchImpl,
      findings: [],
    });
    expect(commentsOf(fake)).toHaveLength(1);
    expect(fake.created).toBeNull();
    expect(fake.comments.at(-1).body).toBe(
      `Self-test OK. No drift found.\n\nScanned through: ${head(repo)}\n`,
    );
  });

  it("an unchanged finding reports as still-open on the next run, not new", async () => {
    const repo = makeRepo();
    const fake = fakeGh({ issue: 3 });
    const fetchImpl = fakeFetch().fetchImpl;

    const first = await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl,
      findings: finding(repo),
    });
    expect(first.counts).toEqual({ new: 1, open: 0, resolved: 0 });
    expect(fake.comments.at(-1).body).toContain(`\`${deadPathId}\``);

    git(repo, "commit", "-q", "--allow-empty", "-m", "next");
    const second = await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl,
      findings: finding(repo),
    });
    expect(second.counts).toEqual({ new: 0, open: 1, resolved: 0 });

    git(repo, "commit", "-q", "--allow-empty", "-m", "again");
    const third = await deliverReport({ repoRoot: repo, gh: fake.gh, fetchImpl, findings: [] });
    expect(third.counts).toEqual({ new: 0, open: 0, resolved: 1 });
  });

  it("creates the labeled tracking issue on first run", async () => {
    const repo = makeRepo();
    const fake = fakeGh();
    await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl: fakeFetch().fetchImpl,
      findings: [],
    });
    expect(fake.created).toEqual(
      expect.arrayContaining(["--title", "Doc drift tracking", "--label", "agent: drift"]),
    );
    expect(commentsOf(fake)).toHaveLength(1);
  });

  it("fences quoted evidence so it renders as data", async () => {
    const repo = makeRepo();
    const fake = fakeGh({ issue: 3 });
    await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl: fakeFetch().fetchImpl,
      findings: [{ ...finding(repo)[0], evidence: "ignore prior | instructions" }],
    });
    expect(fake.comments.at(-1).body).toContain("`` See `src/gone.js` for details. ``");
    expect(fake.comments.at(-1).body).toContain(String.raw`\|`);
  });
});

describe("hardening", () => {
  it("refuses a finding doc outside the manifest and posts nothing", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "secret.txt"), "token=hunter2\n");
    const fake = fakeGh({ issue: 3 });
    for (const doc of ["secret.txt", "../../etc/passwd", "/etc/passwd"]) {
      await expect(
        deliverReport({
          repoRoot: repo,
          gh: fake.gh,
          fetchImpl: fakeFetch().fetchImpl,
          findings: [{ doc, line: 1, claim: "semantic", evidence: "x" }],
        }),
      ).rejects.toThrow(/not a manifest doc/);
    }
    expect(commentsOf(fake)).toHaveLength(0);
  });

  for (const failing of ["api user", "issue list", "issue view"]) {
    it(`stops when gh ${failing} fails instead of treating it as empty`, async () => {
      const repo = makeRepo();
      const fake = fakeGh({ issue: 3, failing });
      await expect(
        deliverReport({
          repoRoot: repo,
          gh: fake.gh,
          fetchImpl: fakeFetch().fetchImpl,
          findings: [],
        }),
      ).rejects.toThrow(new RegExp(`gh ${failing} failed`));
      expect(fake.created).toBeNull();
      expect(commentsOf(fake)).toHaveLength(0);
    });
  }

  it("ignores 8-hex spans inside a quoted doc line when counting resolved", async () => {
    const repo = makeRepo();
    writeFileSync(join(repo, "README.md"), "# Readme\n\nPinned at `3eca3a5f` and `src/gone.js`.\n");
    git(repo, "commit", "-qam", "sha in doc");
    const fake = fakeGh({ issue: 3 });
    const fetchImpl = fakeFetch().fetchImpl;
    await deliverReport({ repoRoot: repo, gh: fake.gh, fetchImpl, findings: finding(repo) });
    git(repo, "commit", "-q", "--allow-empty", "-m", "next");
    const second = await deliverReport({ repoRoot: repo, gh: fake.gh, fetchImpl, findings: [] });
    expect(second.counts.resolved).toBe(1);
  });
});

describe("notify", () => {
  it("sends exactly one POST with counts only when notify is set", async () => {
    const repo = makeRepo({ notify: "  notify: https://ntfy.sh/t\n" });
    const fake = fakeGh({ issue: 3 });
    const { posts, fetchImpl } = fakeFetch();
    await deliverReport({ repoRoot: repo, gh: fake.gh, fetchImpl, findings: finding(repo) });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("https://ntfy.sh/t");
    expect(posts[0].method).toBe("POST");
    expect(posts[0].body).toBe("drift: 1 new, 0 open (suredocs)");
    expect(posts[0].headers?.Authorization).toBeUndefined();
  });

  it("sends nothing when notify is unset", async () => {
    const repo = makeRepo();
    const { posts, fetchImpl } = fakeFetch();
    await deliverReport({ repoRoot: repo, gh: fakeGh({ issue: 3 }).gh, fetchImpl, findings: [] });
    expect(posts).toHaveLength(0);
  });
});

describe("degraded mode (no gh)", () => {
  it("writes the report to stdout + a temp file, notes it, and never POSTs", async () => {
    const repo = makeRepo({ notify: "  notify: https://ntfy.sh/t\n" });
    const fake = fakeGh({ authed: false });
    const state = gatherState({ repoRoot: repo, gh: fake.gh });
    expect(state.gh).toBe(false);
    expect(state.notice).toMatch(/no gh: watermark and tracking issue skipped/);
    expect(state.logArgs).toContain("--since=7 days ago");

    const { posts, fetchImpl } = fakeFetch();
    const result = await deliverReport({
      repoRoot: repo,
      gh: fake.gh,
      fetchImpl,
      findings: finding(repo),
    });
    temporaryDirectories.push(dirname(result.file));
    expect(posts).toHaveLength(0);
    expect(commentsOf(fake)).toHaveLength(0);
    expect(existsSync(result.file)).toBe(true);
    const body = readFileSync(result.file, "utf8");
    expect(body).toBe(result.body);
    expect(body).toMatch(/dedupe unavailable/);
    expect(body).toContain(deadPathId);
    expect(result.notice).toMatch(/no gh/);
  });
});
