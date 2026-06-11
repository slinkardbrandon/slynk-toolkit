import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_HELPER = fileURLToPath(
  new URL("../skills/teach/teach-workspace.mjs", import.meta.url),
);
const LESSON_HELPER = fileURLToPath(new URL("../skills/teach/write-lesson.mjs", import.meta.url));

// Run a helper as the skill does -- a subprocess -- and parse its JSON.
// `input` feeds stdin for `--content -`. Non-zero exit still returns the
// parsed stderr JSON so error contracts are assertable.
function run(helper, args, { input } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [helper, ...args], {
      encoding: "utf8",
      ...(input === undefined ? { stdio: ["ignore", "pipe", "pipe"] } : { input }),
    });
    return { code: 0, out: JSON.parse(stdout) };
  } catch (error) {
    return { code: error.status, out: JSON.parse(error.stderr) };
  }
}

let workspace;
beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "slynk-teach-"));
});
afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe("teach-workspace.mjs", () => {
  it("reports a non-workspace dir as exists: false with empty state", () => {
    const { code, out } = run(WORKSPACE_HELPER, ["--workspace", workspace]);
    expect(code).toBe(0);
    expect(out.exists).toBe(false);
    expect(out.lessons).toEqual([]);
    expect(out.next).toEqual({ lesson: 1, record: 1 });
  });

  it("--scaffold creates the workspace files and reports them", () => {
    const { out } = run(WORKSPACE_HELPER, ["--workspace", workspace, "--scaffold"]);
    expect(out.exists).toBe(true);
    expect(out.scaffolded).toContain("MISSION.md");
    expect(out.scaffolded).toContain("lessons/");
    expect(existsSync(join(workspace, "RESOURCES.md"))).toBe(true);
  });

  it("--scaffold never overwrites an existing file", () => {
    writeFileSync(join(workspace, "MISSION.md"), "# Mission\n\nRun a half marathon by October.\n");
    const { out } = run(WORKSPACE_HELPER, ["--workspace", workspace, "--scaffold"]);
    expect(out.scaffolded).not.toContain("MISSION.md");
    expect(out.mission).toContain("half marathon");
  });

  it("lists numbered artifacts with parsed record status and computes next numbers", () => {
    run(WORKSPACE_HELPER, ["--workspace", workspace, "--scaffold"]);
    writeFileSync(join(workspace, "lessons", "0001-intro.html"), "<html></html>");
    writeFileSync(join(workspace, "lessons", "0003-gap.html"), "<html></html>");
    writeFileSync(
      join(workspace, "learning-records", "0001-knows-git.md"),
      "# LR-0001\n\nStatus: superseded by LR-0002\n",
    );

    const { out } = run(WORKSPACE_HELPER, ["--workspace", workspace]);
    expect(out.lessons.map((lesson) => lesson.number)).toEqual([1, 3]);
    expect(out.next.lesson).toBe(4);
    expect(out.records[0].status).toBe("superseded by LR-0002");
    expect(out.next.record).toBe(2);
  });
});

describe("write-lesson.mjs", () => {
  beforeEach(() => {
    run(WORKSPACE_HELPER, ["--workspace", workspace, "--scaffold"]);
  });

  it("numbers lessons sequentially and writes the content", () => {
    const first = run(
      LESSON_HELPER,
      ["--kind", "lesson", "--slug", "intro", "--content", "-", "--workspace", workspace],
      { input: "<html>one</html>" },
    );
    const second = run(
      LESSON_HELPER,
      ["--kind", "lesson", "--slug", "next", "--content", "-", "--workspace", workspace],
      { input: "<html>two</html>" },
    );

    expect(first.out.number).toBe(1);
    expect(second.out.number).toBe(2);
    expect(readFileSync(second.out.absolute, "utf8")).toBe("<html>two</html>");
    expect(second.out.path).toBe(join("lessons", "0002-next.html"));
  });

  it("numbers records independently of lessons", () => {
    run(
      LESSON_HELPER,
      ["--kind", "lesson", "--slug", "intro", "--content", "-", "--workspace", workspace],
      { input: "x" },
    );
    const record = run(
      LESSON_HELPER,
      ["--kind", "record", "--slug", "knows-x", "--content", "-", "--workspace", workspace],
      { input: "# LR" },
    );
    expect(record.out.number).toBe(1);
    expect(record.out.path).toBe(join("learning-records", "0001-knows-x.md"));
  });

  it("allows overwriting a reference doc (living document)", () => {
    const args = [
      "--kind",
      "reference",
      "--slug",
      "cheats",
      "--content",
      "-",
      "--workspace",
      workspace,
    ];
    run(LESSON_HELPER, args, { input: "v1" });
    const second = run(LESSON_HELPER, args, { input: "v2" });
    expect(second.code).toBe(0);
    expect(readFileSync(second.out.absolute, "utf8")).toBe("v2");
  });

  it("rejects a path-traversal slug", () => {
    const { code, out } = run(
      LESSON_HELPER,
      ["--kind", "lesson", "--slug", "../evil", "--content", "-", "--workspace", workspace],
      { input: "x" },
    );
    expect(code).toBe(1);
    expect(out.error).toMatch(/slug/i);
  });

  it("refuses to write outside a teaching workspace", () => {
    const bare = mkdtempSync(join(tmpdir(), "slynk-bare-"));
    const { code, out } = run(
      LESSON_HELPER,
      ["--kind", "lesson", "--slug", "x", "--content", "-", "--workspace", bare],
      { input: "x" },
    );
    rmSync(bare, { recursive: true, force: true });
    expect(code).toBe(1);
    expect(out.error).toMatch(/MISSION\.md/);
  });
});
