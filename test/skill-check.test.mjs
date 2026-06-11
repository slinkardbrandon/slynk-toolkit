import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECK = fileURLToPath(new URL("../skills/write-skill/skill-check.mjs", import.meta.url));
const SCAFFOLD = fileURLToPath(
  new URL("../skills/write-skill/skill-scaffold.mjs", import.meta.url),
);
const REVIEW_CONTEXT = fileURLToPath(
  new URL("../skills/skill-review/skill-review-context.mjs", import.meta.url),
);
// The repo's real skills/ -- every shipped skill must pass its own lint.
const REAL_SKILLS = fileURLToPath(new URL("../skills", import.meta.url));

function run(script, args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: JSON.parse(stdout) };
  } catch (error) {
    // skill-check exits 1 on error findings but still reports on stdout.
    return { code: error.status, out: JSON.parse(error.stdout || error.stderr) };
  }
}

const rules = (result, level) =>
  result.out.findings.filter((finding) => finding.level === level).map((finding) => finding.rule);

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "slynk-check-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

// A minimal compliant skill to mutate per test.
function makeSkill({ description, body = "", helpers = {} } = {}) {
  const dir = join(root, "demo");
  mkdirSync(dir);
  const desc =
    description ??
    "Does a demo thing for fixtures and nothing else, deterministically. Use when testing the demo fixture.";
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: demo\ndescription: >-\n  ${desc}\n---\n\n${body}\n`,
  );
  for (const [name, source] of Object.entries(helpers)) writeFileSync(join(dir, name), source);
  return dir;
}

describe("skill-check.mjs", () => {
  it("passes a compliant skill", () => {
    const { code, out } = run(CHECK, [makeSkill()]);
    expect(code).toBe(0);
    expect(out.pass).toBe(true);
    expect(out.findings).toEqual([]);
  });

  it("errors when SKILL.md is missing", () => {
    const dir = join(root, "empty");
    mkdirSync(dir);
    const result = run(CHECK, [dir]);
    expect(result.code).toBe(1);
    expect(rules(result, "error")).toContain("frontmatter");
  });

  it("errors on a missing description and warns on a missing trigger clause", () => {
    const noDesc = join(root, "nodesc");
    mkdirSync(noDesc);
    writeFileSync(join(noDesc, "SKILL.md"), "---\nname: nodesc\n---\n\nbody\n");
    expect(rules(run(CHECK, [noDesc]), "error")).toContain("description");

    const noTrigger = makeSkill({
      description:
        "Does a demo thing for fixtures with plenty of detail but no trigger clause at all.",
    });
    expect(rules(run(CHECK, [noTrigger]), "warn")).toContain("description");
  });

  it("errors on a real echo-pipe but allows the doc-mention form", () => {
    const offending = makeSkill({ body: "Run: echo 'real content' | node helper.mjs\n" });
    expect(rules(run(CHECK, [offending]), "error")).toContain("echo-pipe");
    rmSync(offending, { recursive: true });

    const mention = makeSkill({
      body: "Never pipe via `echo '...' | node` -- use a scratch file.\n",
    });
    expect(run(CHECK, [mention]).out.pass).toBe(true);
  });

  it("errors on a bare (non node:, non relative) helper import", () => {
    const dir = makeSkill({
      body: 'Run node "{{SLYNK_DIR}}/h.mjs"\n',
      helpers: { "h.mjs": 'import yaml from "js-yaml";\nconsole.log(yaml);\n' },
    });
    expect(rules(run(CHECK, [dir]), "error")).toContain("helper-deps");
  });

  it("catches a literal dynamic import of a bare package", () => {
    const dir = makeSkill({
      body: 'Run node "{{SLYNK_DIR}}/h.mjs"\n',
      helpers: { "h.mjs": 'const pad = await import("left-pad");\nconsole.log(pad);\n' },
    });
    expect(rules(run(CHECK, [dir]), "error")).toContain("helper-deps");
  });

  it("warns when helpers exist but SKILL.md never uses the sentinel", () => {
    const dir = makeSkill({ helpers: { "h.mjs": 'console.log("x");\n' } });
    expect(rules(run(CHECK, [dir]), "warn")).toContain("sentinel");
  });

  it("accepts the slynk- prefixed dir name an install produces", () => {
    const dir = join(root, "slynk-demo");
    mkdirSync(dir);
    writeFileSync(
      join(dir, "SKILL.md"),
      "---\nname: demo\ndescription: >-\n  Does a demo thing, deterministically. Use when testing prefixed installs.\n---\n\nbody\n",
    );
    const result = run(CHECK, [dir]);
    expect(result.out.findings.filter((finding) => finding.rule === "name")).toEqual([]);
  });
});

describe("skill-scaffold.mjs", () => {
  it("scaffolds a skill that passes skill-check, including helper stubs", () => {
    const scaffolded = run(SCAFFOLD, [
      "--name",
      "demo-thing",
      "--root",
      root,
      "--helper",
      "demo-context",
    ]);
    expect(scaffolded.code).toBe(0);
    expect(scaffolded.out.files).toEqual(["SKILL.md", "demo-context.mjs"]);

    const checked = run(CHECK, [join(root, "demo-thing")]);
    expect(checked.out.pass).toBe(true);
  });

  it("refuses to scaffold over an existing dir and rejects bad names", () => {
    mkdirSync(join(root, "taken"));
    expect(run(SCAFFOLD, ["--name", "taken", "--root", root]).code).toBe(1);
    expect(run(SCAFFOLD, ["--name", "Not_Kebab", "--root", root]).code).toBe(1);
  });
});

describe("skill-review-context.mjs", () => {
  it("loads a skill and folds in the sibling mechanical check", () => {
    const { code, out } = run(REVIEW_CONTEXT, [join(REAL_SKILLS, "teach")]);
    expect(code).toBe(0);
    expect(out.error).toBeNull();
    expect(out.skillMd).toContain("name: teach");
    expect(out.helpers.map((helper) => helper.name)).toContain("teach-workspace.mjs");
    expect(out.mechanical.pass).toBe(true);
  });

  it("reports a non-skill dir as an error, not a crash", () => {
    const { code, out } = run(REVIEW_CONTEXT, [root]);
    expect(code).toBe(0);
    expect(out.error).toMatch(/not a skill/i);
  });
});

describe("shipped skills", () => {
  it("every skill in skills/ passes its own mechanical check", () => {
    const skills = [
      "brainstorm",
      "spec",
      "handoff",
      "create-pr",
      "spec-review",
      "teach",
      "write-skill",
      "skill-review",
    ];
    for (const skill of skills) {
      const { out } = run(CHECK, [join(REAL_SKILLS, skill)]);
      expect(out.pass, `${skill} failed: ${JSON.stringify(out.findings)}`).toBe(true);
    }
  });
});
