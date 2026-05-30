import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PREFIX,
  renderSkill,
  resolveRuntimes,
  listSkills,
  install,
  uninstall,
} from "../lib/installer.mjs";

// The repo's real skills/ dir -- the source the published package ships.
const REAL_SKILLS = fileURLToPath(new URL("../skills", import.meta.url));

// A literal backslash, sourced via unicode escape so the lint rule that bans
// `\\` string escapes stays happy while we assert paths never contain one.
const BACKSLASH = "\u005C";

// Build a throwaway HOME with all four agent config dirs present so
// resolveRuntimes detects every runtime. No real agent dir is ever touched.
function makeHome() {
  const home = mkdtempSync(join(tmpdir(), "slynk-home-"));
  for (const dir of [".claude", ".copilot", ".agents", join(".config", "opencode")]) {
    mkdirSync(join(home, dir), { recursive: true });
  }
  return home;
}

// A synthetic single-skill source: lets us mutate a helper and prove --link
// reflects it. Returns the source root (containing one skill dir, "demo").
function makeFixtureSkills() {
  const root = mkdtempSync(join(tmpdir(), "slynk-src-"));
  const skill = join(root, "demo");
  mkdirSync(skill, { recursive: true });
  writeFileSync(
    join(skill, "SKILL.md"),
    [
      "---",
      "name: demo",
      "description: fixture",
      "---",
      "",
      'Run it: node "{{SLYNK_DIR}}/demo-helper.mjs"',
      "",
    ].join("\n"),
  );
  writeFileSync(join(skill, "demo-helper.mjs"), 'console.log("v1");\n');
  return root;
}

let home;
let env;

beforeEach(() => {
  home = makeHome();
  // Pin XDG so OpenCode lands under our scratch HOME, not the machine's.
  env = { XDG_CONFIG_HOME: join(home, ".config") };
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

describe("renderSkill", () => {
  it("rewrites frontmatter name to the slynk- prefix and expands the token", () => {
    const body = [
      "---",
      "name: demo",
      "description: x",
      "---",
      'node "{{SLYNK_DIR}}/h.mjs"',
      "",
    ].join("\n");
    const out = renderSkill(body, { slynkDir: "/abs/dest/slynk-demo", name: "demo" });
    expect(out).toContain("name: slynk-demo");
    expect(out).not.toMatch(/^name: demo$/m);
    expect(out).toContain('node "/abs/dest/slynk-demo/h.mjs"');
    expect(out).not.toContain("{{SLYNK_DIR}}");
  });

  it("only rewrites the frontmatter name, not body text containing 'name:'", () => {
    const body = ["---", "name: demo", "---", "a line about name: foo in prose", ""].join("\n");
    const out = renderSkill(body, { slynkDir: "/x", name: "demo" });
    expect(out).toContain("name: slynk-demo");
    expect(out).toContain("a line about name: foo in prose");
  });

  it("emits forward-slash paths even when given a backslash dir (Windows-safe)", () => {
    const out = renderSkill('node "{{SLYNK_DIR}}/h.mjs"', {
      slynkDir: String.raw`C:\Users\me\.claude\skills\slynk-demo`,
      name: "demo",
    });
    expect(out).not.toContain(BACKSLASH);
    expect(out).toContain("C:/Users/me/.claude/skills/slynk-demo/h.mjs");
  });
});

describe("resolveRuntimes", () => {
  it("detects all four runtimes when their config dirs exist", () => {
    const ids = resolveRuntimes({ home, env }).map((r) => r.id);
    expect(new Set(ids)).toEqual(new Set(["claude", "copilot", "codex", "opencode"]));
  });

  it("omits a runtime whose config dir is absent", () => {
    rmSync(join(home, ".copilot"), { recursive: true, force: true });
    const ids = resolveRuntimes({ home, env }).map((r) => r.id);
    expect(ids).not.toContain("copilot");
  });

  it("resolves Codex to ~/.agents/skills, never ~/.codex/skills", () => {
    const codex = resolveRuntimes({ home, env }).find((r) => r.id === "codex");
    expect(codex.skills).toBe(join(home, ".agents", "skills"));
    expect(codex.skills).not.toContain(".codex");
  });
});

describe("copy install (the published default)", () => {
  let runtimes;
  beforeEach(() => {
    runtimes = resolveRuntimes({ home, env });
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy" });
  });

  it("creates slynk-<name>/ in every runtime with name rewritten and token expanded", () => {
    for (const rt of runtimes) {
      for (const name of listSkills(REAL_SKILLS)) {
        const destination = join(rt.skills, PREFIX + name);
        const skillMd = join(destination, "SKILL.md");
        expect(existsSync(skillMd)).toBe(true);
        const content = readFileSync(skillMd, "utf8");
        expect(content).toContain(`name: ${PREFIX}${name}`);
        expect(content).not.toContain("{{SLYNK_DIR}}");
        expect(content).not.toContain("CLAUDE_PLUGIN_ROOT");
      }
    }
  });

  it("expands {{SLYNK_DIR}} to the destination skill dir and ships the helper sibling", () => {
    const rt = runtimes.find((r) => r.id === "claude");
    const destination = join(rt.skills, `${PREFIX}spec`);
    const content = readFileSync(join(destination, "SKILL.md"), "utf8");
    expect(content).toContain(`node "${destination}/spec-context.mjs"`);
    expect(existsSync(join(destination, "spec-context.mjs"))).toBe(true);
  });

  it("frontmatter name equals dirname for every installed skill (Copilot contract)", () => {
    for (const rt of runtimes) {
      for (const entry of readdirSync(rt.skills)) {
        const md = readFileSync(join(rt.skills, entry, "SKILL.md"), "utf8");
        const name = md.match(/^name:\s*(.+)$/m)[1].trim();
        expect(name).toBe(entry);
      }
    }
  });

  it("never emits a backslash in the templated path", () => {
    for (const rt of runtimes) {
      for (const entry of readdirSync(rt.skills)) {
        const md = readFileSync(join(rt.skills, entry, "SKILL.md"), "utf8");
        const lines = md.split("\n").filter((line) => line.includes(rt.skills));
        for (const line of lines) expect(line).not.toContain(BACKSLASH);
      }
    }
  });

  it("is idempotent -- re-running replaces, no duplicates", () => {
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy" });
    const rt = runtimes.find((r) => r.id === "claude");
    const entries = readdirSync(rt.skills).filter((entry) => entry.startsWith(PREFIX));
    expect(entries.length).toBe(listSkills(REAL_SKILLS).length);
  });
});

describe("--link install (dev from a clone)", () => {
  it("templates SKILL.md to the clone path and reflects helper edits without re-install", () => {
    const source = makeFixtureSkills();
    try {
      const runtimes = resolveRuntimes({ home, env });
      install({ skillsSource: source, runtimes, mode: "link" });

      const rt = runtimes.find((r) => r.id === "claude");
      const destination = join(rt.skills, `${PREFIX}demo`);
      const md = readFileSync(join(destination, "SKILL.md"), "utf8");

      // Token points back at the clone's skill dir, not the destination.
      const cloneSkill = join(source, "demo");
      expect(md).toContain(`node "${cloneSkill}/demo-helper.mjs"`);
      // Helper is NOT copied into the destination -- it's read live from the clone.
      expect(existsSync(join(destination, "demo-helper.mjs"))).toBe(false);

      // Editing the clone helper is reflected at the path the SKILL.md targets.
      writeFileSync(join(cloneSkill, "demo-helper.mjs"), 'console.log("v2");\n');
      expect(readFileSync(join(cloneSkill, "demo-helper.mjs"), "utf8")).toContain("v2");
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });
});

describe("uninstall", () => {
  it("removes only slynk-* entries and leaves the user's own skills untouched", () => {
    const runtimes = resolveRuntimes({ home, env });
    const rt = runtimes.find((r) => r.id === "claude");
    // A skill the user authored themselves.
    mkdirSync(join(rt.skills, "my-own-skill"), { recursive: true });
    writeFileSync(join(rt.skills, "my-own-skill", "SKILL.md"), "---\nname: my-own-skill\n---\n");

    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy" });
    uninstall({ runtimes });

    const remaining = readdirSync(rt.skills);
    expect(remaining).toContain("my-own-skill");
    expect(remaining.some((entry) => entry.startsWith(PREFIX))).toBe(false);
  });
});
