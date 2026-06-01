import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  symlinkSync,
  lstatSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readSpecConfig, gatherConventionFiles } from "../skills/slynk-mjs-utils/spec-config.mjs";
import {
  PREFIX,
  renderSkill,
  resolveRuntimes,
  listSkills,
  listSharedLibs,
  install,
  uninstall,
  buildAgentsBlock,
  writeAgentsBlock,
  removeAgentsBlock,
  writeCcHook,
  removeCcHook,
} from "../lib/installer.mjs";

// The repo's real skills/ dir -- the source the published package ships.
const REAL_SKILLS = fileURLToPath(new URL("../skills", import.meta.url));
// The real hook script the installer deploys / settings.json calls.
const HOOK_SOURCE = fileURLToPath(new URL("../hooks/bootstrap-hook.mjs", import.meta.url));
// The spec-review helper that resolves the spec under review.
const SPEC_REVIEW_HELPER = fileURLToPath(
  new URL("../skills/spec-review/spec-review-context.mjs", import.meta.url),
);
// The spec Phase-0 context helper (consumes the shared .spec.yml reader).
const SPEC_CONTEXT_HELPER = fileURLToPath(
  new URL("../skills/spec/spec-context.mjs", import.meta.url),
);

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
      // listSkills enumerates SKILL.md-bearing dirs only -- shared libs (no
      // SKILL.md) are correctly skipped here.
      for (const entry of listSkills(rt.skills)) {
        const md = readFileSync(join(rt.skills, entry, "SKILL.md"), "utf8");
        const name = md.match(/^name:\s*(.+)$/m)[1].trim();
        expect(name).toBe(entry);
      }
    }
  });

  it("never emits a backslash in the templated path", () => {
    for (const rt of runtimes) {
      for (const entry of listSkills(rt.skills)) {
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
    // Every slynk-* dir is either an installed skill or a copied shared lib.
    expect(entries.length).toBe(
      listSkills(REAL_SKILLS).length + listSharedLibs(REAL_SKILLS).length,
    );
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

// --- bootstrap session hook ------------------------------------------------

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const slynkMatchers = (settings) =>
  (settings.hooks?.SessionStart ?? []).filter((matcher) =>
    matcher.hooks?.some((h) => h.command?.includes("bootstrap-hook.mjs")),
  );

describe("CC SessionStart hook (settings.json)", () => {
  let runtimes;
  let settingsFile;
  beforeEach(() => {
    runtimes = resolveRuntimes({ home, env });
    settingsFile = join(home, ".claude", "settings.json");
  });

  it("writes the hook while preserving pre-existing keys and the user's own SessionStart entry", () => {
    writeFileSync(
      settingsFile,
      JSON.stringify({
        model: "opus",
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }],
          PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "lint" }] }],
        },
      }),
    );
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });

    const settings = readJson(settingsFile);
    expect(settings.model).toBe("opus"); // unrelated key survives
    expect(settings.hooks.PreToolUse).toHaveLength(1); // unrelated hook survives
    expect(settings.hooks.SessionStart).toHaveLength(2); // user's entry + ours
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("echo hi");
    const ours = slynkMatchers(settings);
    expect(ours).toHaveLength(1);
    expect(ours[0].hooks[0]).toMatchObject({ type: "command", timeout: 10 });
    expect(ours[0].hooks[0].command).toContain("bootstrap-hook.mjs");
    expect(ours[0].matcher).toBeUndefined(); // fires on every session source
  });

  it("is idempotent -- re-running install adds no duplicate slynk entry", () => {
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });
    expect(slynkMatchers(readJson(settingsFile))).toHaveLength(1);
  });

  it("replaces an older slynk hook of a different command shape, no duplicate", () => {
    writeFileSync(
      settingsFile,
      JSON.stringify({
        hooks: {
          SessionStart: [
            { hooks: [{ type: "command", command: "node /old/path/slynk/bootstrap-hook.mjs" }] },
          ],
        },
      }),
    );
    writeCcHook({ settingsFile, scriptPath: "/new/path/slynk/bootstrap-hook.mjs" });
    const ours = slynkMatchers(readJson(settingsFile));
    expect(ours).toHaveLength(1);
    expect(ours[0].hooks[0].command).toContain("/new/path/");
  });

  it("uninstall removes only the slynk hook, leaving the user's hooks and keys intact", () => {
    writeFileSync(settingsFile, JSON.stringify({ model: "opus" }));
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });
    // Add a user SessionStart entry alongside ours, then uninstall.
    const withUser = readJson(settingsFile);
    withUser.hooks.SessionStart.unshift({ hooks: [{ type: "command", command: "echo hi" }] });
    writeFileSync(settingsFile, JSON.stringify(withUser));

    uninstall({ runtimes });

    const settings = readJson(settingsFile);
    expect(settings.model).toBe("opus");
    expect(slynkMatchers(settings)).toHaveLength(0);
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].command).toBe("echo hi");
  });

  it("keeps a symlinked settings.json a symlink after writing", () => {
    const real = join(home, "real-settings.json");
    writeFileSync(real, JSON.stringify({ model: "opus" }));
    symlinkSync(real, settingsFile);

    writeCcHook({ settingsFile, scriptPath: "/x/slynk/bootstrap-hook.mjs" });

    expect(lstatSync(settingsFile).isSymbolicLink()).toBe(true);
    expect(readJson(real).model).toBe("opus"); // wrote through to the real file
    expect(slynkMatchers(readJson(real))).toHaveLength(1);
  });

  it("malformed settings.json -> CC hook skipped, skills still install, file not clobbered", () => {
    writeFileSync(settingsFile, "{ not: valid json, }");
    const result = install({
      skillsSource: REAL_SKILLS,
      runtimes,
      mode: "copy",
      hookSource: HOOK_SOURCE,
    });

    // File left exactly as it was.
    expect(readFileSync(settingsFile, "utf8")).toBe("{ not: valid json, }");
    // Skills still landed.
    const rt = runtimes.find((r) => r.id === "claude");
    expect(readdirSync(rt.skills).some((entry) => entry.startsWith(PREFIX))).toBe(true);
    // Status reports the skip.
    expect(result.nudge.find((n) => n.id === "claude").kind).toBe("skipped");
  });

  it("link mode points the command at the clone; copy mode at <config>/slynk/", () => {
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "link", hookSource: HOOK_SOURCE });
    expect(slynkMatchers(readJson(settingsFile))[0].hooks[0].command).toContain(HOOK_SOURCE);

    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });
    const copied = join(home, ".claude", "slynk", "bootstrap-hook.mjs");
    expect(slynkMatchers(readJson(settingsFile))[0].hooks[0].command).toContain(copied);
    expect(existsSync(copied)).toBe(true); // script copied alongside
  });
});

describe("AGENTS.md managed block", () => {
  it("lists only installed routes, with the slynk- prefix", () => {
    expect(buildAgentsBlock(["spec"])).toContain("ready to build -> slynk-spec");
    expect(buildAgentsBlock(["spec"])).not.toContain("slynk-brainstorm");
    expect(buildAgentsBlock([])).toBeNull(); // no skills -> no block
  });

  it("is written per non-claude agent; claude gets the hook, not a block", () => {
    const runtimes = resolveRuntimes({ home, env });
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });

    expect(existsSync(join(home, ".claude", "AGENTS.md"))).toBe(false);
    expect(existsSync(join(home, ".claude", "settings.json"))).toBe(true);
    expect(readFileSync(join(home, ".copilot", "AGENTS.md"), "utf8")).toContain("## slynk skills");
    expect(readFileSync(join(home, ".config", "opencode", "AGENTS.md"), "utf8")).toContain(
      "slynk:bootstrap:start",
    );
    // Codex's block lands under CODEX_HOME (~/.codex), not its ~/.agents skills dir.
    expect(existsSync(join(home, ".codex", "AGENTS.md"))).toBe(true);
    expect(existsSync(join(home, ".agents", "AGENTS.md"))).toBe(false);
  });

  it("creates when absent, replaces in place when present (no dupes), leaves user content", () => {
    const agentsFile = join(home, ".copilot", "AGENTS.md");
    writeFileSync(agentsFile, "# My rules\n\nAlways use tabs.\n");
    const block = buildAgentsBlock(["spec", "handoff"]);

    writeAgentsBlock({ agentsFile, block });
    let content = readFileSync(agentsFile, "utf8");
    expect(content).toContain("# My rules");
    expect(content).toContain("Always use tabs.");
    expect(content.match(/slynk:bootstrap:start/g)).toHaveLength(1);

    // Re-write with a different block -> replaced in place, still single region.
    writeAgentsBlock({ agentsFile, block: buildAgentsBlock(["spec"]) });
    content = readFileSync(agentsFile, "utf8");
    expect(content.match(/slynk:bootstrap:start/g)).toHaveLength(1);
    expect(content).toContain("# My rules");
    expect(content).not.toContain("slynk-handoff"); // old route gone
  });

  it("uninstall strips the block and leaves surrounding content intact", () => {
    const agentsFile = join(home, ".copilot", "AGENTS.md");
    writeFileSync(agentsFile, "# My rules\n\nAlways use tabs.\n");
    writeAgentsBlock({ agentsFile, block: buildAgentsBlock(["spec"]) });

    removeAgentsBlock({ agentsFile });
    const content = readFileSync(agentsFile, "utf8");
    expect(content).not.toContain("slynk:bootstrap");
    expect(content).toBe("# My rules\n\nAlways use tabs.\n");
  });

  it("uninstall via the installer strips every agent's block", () => {
    const runtimes = resolveRuntimes({ home, env });
    install({ skillsSource: REAL_SKILLS, runtimes, mode: "copy", hookSource: HOOK_SOURCE });
    uninstall({ runtimes });
    for (const file of [
      join(home, ".copilot", "AGENTS.md"),
      join(home, ".codex", "AGENTS.md"),
      join(home, ".config", "opencode", "AGENTS.md"),
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("slynk:bootstrap");
    }
  });

  it("removeCcHook on a missing or unparseable settings.json is a no-op", () => {
    const missing = join(home, ".claude", "nope.json");
    expect(() => removeCcHook({ settingsFile: missing })).not.toThrow();
    const bad = join(home, ".claude", "settings.json");
    writeFileSync(bad, "{ not json");
    removeCcHook({ settingsFile: bad });
    expect(readFileSync(bad, "utf8")).toBe("{ not json"); // untouched
  });
});

// Run the real hook script against a scratch Claude config dir. The script's own
// sibling (the clone's skills/, bare skill names + the slynk-mjs-utils lib) has no
// routable slynk-* skill, so it falls back to CLAUDE_CONFIG_DIR -- the path we control.
function runHook(configDir) {
  return execFileSync("node", [HOOK_SOURCE], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf8",
  });
}

function seedSkills(names) {
  const configDir = mkdtempSync(join(tmpdir(), "slynk-cfg-"));
  for (const name of names) {
    mkdirSync(join(configDir, "skills", PREFIX + name), { recursive: true });
  }
  return configDir;
}

describe("hook script runtime behavior", () => {
  it("emits valid SessionStart JSON with additionalContext", () => {
    const configDir = seedSkills(["brainstorm", "spec", "create-pr", "handoff"]);
    try {
      const parsed = JSON.parse(runHook(configDir));
      expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
      expect(parsed.hookSpecificOutput.additionalContext).toContain("slynk-brainstorm");
      expect(parsed.hookSpecificOutput.additionalContext).toContain("slynk-handoff");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it("availability gating: only the installed route appears", () => {
    const configDir = seedSkills(["spec"]);
    try {
      const context = JSON.parse(runHook(configDir)).hookSpecificOutput.additionalContext;
      expect(context).toContain("slynk-spec");
      expect(context).not.toContain("slynk-brainstorm");
      expect(context).not.toContain("slynk-handoff");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it("zero slynk skills -> emits nothing, exits 0", () => {
    const configDir = seedSkills([]);
    try {
      expect(runHook(configDir)).toBe("");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});

// --- spec-review-context.mjs (spec resolution) -----------------------------

// Run the helper against a scratch repo and return its parsed JSON.
function runSpecReview(args) {
  const out = execFileSync("node", [SPEC_REVIEW_HELPER, ...args], { encoding: "utf8" });
  return JSON.parse(out);
}

describe("spec-review-context.mjs", () => {
  let repo;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "slynk-spec-"));
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("resolves an explicit spec path and returns its content", () => {
    const specPath = join(repo, "anywhere.md");
    writeFileSync(specPath, "# Explicit spec\n\nbody\n");
    const result = runSpecReview([specPath, "--repo", repo]);
    expect(result.error).toBeNull();
    expect(result.spec.path).toBe(specPath);
    expect(result.spec.content).toContain("# Explicit spec");
  });

  it("resolves the latest spec in output_dir when no path is given", () => {
    const dir = join(repo, "docs", "specs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "2026-01-01-old.md"), "# old\n");
    writeFileSync(join(dir, "2026-05-01-new.md"), "# new\n");
    const result = runSpecReview(["--repo", repo]);
    expect(result.error).toBeNull();
    expect(result.spec.relativePath).toBe(join("docs", "specs", "2026-05-01-new.md"));
    expect(result.spec.content).toContain("# new");
  });

  it("respects a .spec.yml output_dir override", () => {
    writeFileSync(join(repo, ".spec.yml"), "output_dir: specs/custom\n");
    const dir = join(repo, "specs", "custom");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "2026-05-01-here.md"), "# in override dir\n");
    const result = runSpecReview(["--repo", repo]);
    expect(result.error).toBeNull();
    expect(result.config.outputDir).toBe("specs/custom");
    expect(result.spec.relativePath).toBe(join("specs", "custom", "2026-05-01-here.md"));
  });

  it("returns a graceful no-spec signal rather than throwing", () => {
    // No docs/specs dir, no explicit path -> error string, exit 0, spec null.
    const result = runSpecReview(["--repo", repo]);
    expect(result.spec).toBeNull();
    expect(result.error).toMatch(/no spec/i);
  });

  it("returns a graceful signal for an explicit path that does not exist", () => {
    const result = runSpecReview([join(repo, "nope.md"), "--repo", repo]);
    expect(result.spec).toBeNull();
    expect(result.error).toMatch(/no spec found/i);
  });
});

// --- shared libs (skills/* dirs with no SKILL.md) --------------------------

// A source tree with one real skill, one prefixed shared lib, and one
// unprefixed no-SKILL.md dir (the clobber-guard case).
function makeFixtureWithLibrary() {
  const root = mkdtempSync(join(tmpdir(), "slynk-libsrc-"));
  const skill = join(root, "demo");
  mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "---\nname: demo\n---\nbody\n");
  const library = join(root, "slynk-mjs-utils");
  mkdirSync(library, { recursive: true });
  writeFileSync(join(library, "spec-config.mjs"), "export const x = 1;\n");
  const rogue = join(root, "utils");
  mkdirSync(rogue, { recursive: true });
  writeFileSync(join(rogue, "helper.mjs"), "export const y = 2;\n");
  return root;
}

describe("shared libs", () => {
  it("listSkills excludes no-SKILL.md dirs; listSharedLibs returns them", () => {
    const source = makeFixtureWithLibrary();
    try {
      expect(listSkills(source)).toEqual(["demo"]);
      expect(listSharedLibs(source).toSorted()).toEqual(["slynk-mjs-utils", "utils"]);
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("the real skills tree ships slynk-mjs-utils as a lib, not a skill", () => {
    expect(listSkills(REAL_SKILLS)).not.toContain("slynk-mjs-utils");
    expect(listSharedLibs(REAL_SKILLS)).toContain("slynk-mjs-utils");
  });

  it("copy mode lands a prefixed lib verbatim and skips an unprefixed one", () => {
    const source = makeFixtureWithLibrary();
    try {
      const runtimes = resolveRuntimes({ home, env });
      const result = install({ skillsSource: source, runtimes, mode: "copy" });

      expect(result.sharedLibs).toEqual(["slynk-mjs-utils"]);
      expect(result.skippedLibs).toEqual(["utils"]);
      expect(result.skills).toEqual(["demo"]); // lib absent from skill labels

      for (const rt of runtimes) {
        const library = join(rt.skills, "slynk-mjs-utils");
        expect(existsSync(library)).toBe(true); // verbatim, unprefixed dir name
        expect(existsSync(join(library, "spec-config.mjs"))).toBe(true);
        expect(existsSync(join(rt.skills, `${PREFIX}slynk-mjs-utils`))).toBe(false); // no double prefix
        expect(existsSync(join(rt.skills, "utils"))).toBe(false); // clobber guard: not copied
        expect(existsSync(join(library, "SKILL.md"))).toBe(false); // libs carry no SKILL.md
      }
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("link mode writes no lib copy (resolved from the clone tree instead)", () => {
    const source = makeFixtureWithLibrary();
    try {
      const runtimes = resolveRuntimes({ home, env });
      install({ skillsSource: source, runtimes, mode: "link" });
      for (const rt of runtimes) {
        expect(existsSync(join(rt.skills, "slynk-mjs-utils"))).toBe(false);
      }
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });

  it("uninstall sweeps a copied lib via the prefix rule", () => {
    const source = makeFixtureWithLibrary();
    try {
      const runtimes = resolveRuntimes({ home, env });
      install({ skillsSource: source, runtimes, mode: "copy" });
      uninstall({ runtimes });
      for (const rt of runtimes) {
        expect(existsSync(join(rt.skills, "slynk-mjs-utils"))).toBe(false);
      }
    } finally {
      rmSync(source, { recursive: true, force: true });
    }
  });
});

// --- shared .spec.yml reader (skills/slynk-mjs-utils/spec-config.mjs) -------

describe("readSpecConfig (shared reader)", () => {
  let repo;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "slynk-cfg-"));
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("defaults to docs/specs + CONTEXT.md when no .spec.yml exists", () => {
    expect(readSpecConfig(repo)).toEqual({ outputDir: "docs/specs", contextFile: "CONTEXT.md" });
  });

  it("honors an output_dir override (the bug fix)", () => {
    writeFileSync(join(repo, ".spec.yml"), "output_dir: specs/custom\n");
    expect(readSpecConfig(repo).outputDir).toBe("specs/custom");
  });

  it("honors a context_file override, and context_file: false returns false", () => {
    writeFileSync(join(repo, ".spec.yml"), "context_file: false\n");
    expect(readSpecConfig(repo).contextFile).toBe(false);
    writeFileSync(join(repo, ".spec.yml"), "context_file: GLOSSARY.md\n");
    expect(readSpecConfig(repo).contextFile).toBe("GLOSSARY.md");
  });

  it("strips inline comments and surrounding quotes", () => {
    writeFileSync(join(repo, ".spec.yml"), 'output_dir: "specs"  # where specs go\n');
    expect(readSpecConfig(repo).outputDir).toBe("specs");
  });

  it("gatherConventionFiles returns present files in canonical order", () => {
    writeFileSync(join(repo, "AGENTS.md"), "agents\n");
    writeFileSync(join(repo, "CONTEXT.md"), "context\n");
    expect(Object.keys(gatherConventionFiles(repo))).toEqual(["AGENTS.md", "CONTEXT.md"]);
  });
});

// --- spec-context.mjs end-to-end (the bug fix through its real consumer) ----

describe("spec-context.mjs override (end-to-end)", () => {
  it("resume reader resolves specs in a .spec.yml output_dir override", () => {
    const repo = mkdtempSync(join(tmpdir(), "slynk-ctx-"));
    try {
      writeFileSync(join(repo, ".spec.yml"), "output_dir: specs/custom\n");
      const dir = join(repo, "specs", "custom");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "2026-05-01-here.md"), "# in override dir\n");

      const out = execFileSync("node", [SPEC_CONTEXT_HELPER, "--repo", repo], { encoding: "utf8" });
      const result = JSON.parse(out);

      expect(result.config.outputDir).toBe("specs/custom");
      expect(result.specHistory.map((s) => s.filename)).toContain("2026-05-01-here.md");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
