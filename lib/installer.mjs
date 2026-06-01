// Installer core. Copies (or, in dev, clone-references) each slynk skill into
// every detected agent's skills dir. Importable and side-effect-free at module
// load; `home`/`env`/`runtimes` are injectable so the vitest specs drive it
// against a scratch HOME without touching a real agent install.
//
// Two mechanical substitutions happen per SKILL.md (see renderSkill):
//   1. {{SLYNK_DIR}} -> the skill's absolute install dir (forward-slash, so
//      win32 node accepts it and no backslash leaks into a quoted shell arg).
//   2. frontmatter `name:` -> `slynk-<skill>` (== dirname: Copilot's and
//      OpenCode's load contract; harmless convention for Claude).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  renameSync,
  realpathSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";

// Namespaced dir prefix so we never clobber a user's own skills, and uniform
// `slynk-<skill>` invocation across runtimes.
export const PREFIX = "slynk-";

const TOKEN = "{{SLYNK_DIR}}";

// node accepts forward slashes on win32; backslashes would break inside the
// double-quoted `node "<path>/helper.mjs"` calls in SKILL.md.
function toPosix(p) {
  return p.replaceAll("\\", "/");
}

// Apply the two substitutions to a SKILL.md body. `slynkDir` is where the
// skill's helpers live at runtime (dest dir for copy, clone dir for --link).
export function renderSkill(content, { slynkDir, name }) {
  let out = content;

  // Rewrite `name:` only inside the leading frontmatter block, so prose that
  // happens to contain "name:" is left alone.
  const frontmatter = out.match(/^---\n[\s\S]*?\n---/);
  if (frontmatter) {
    const rewritten = frontmatter[0].replace(/^name:[ \t]*.*$/m, `name: ${PREFIX}${name}`);
    out =
      out.slice(0, frontmatter.index) +
      rewritten +
      out.slice(frontmatter.index + frontmatter[0].length);
  }

  return out.replaceAll(TOKEN, toPosix(slynkDir));
}

// Per-runtime config dir (parent of skills/), honoring env overrides. Paths are
// verified against each runtime's real discovery code (see docs/runtime-support.md):
// Codex reads ~/.agents/skills, NOT ~/.codex/skills.
//
// bootstrap = how the runtime gets the router nudge:
//   "hook"   -- Claude Code SessionStart hook in settings.json (it reads CLAUDE.md, not AGENTS.md).
//   "agents" -- a managed block in the runtime's global AGENTS.md.
// Codex splits the two: skills load from ~/.agents, but its global AGENTS.md lives
// under CODEX_HOME (~/.codex), so agentsDir diverges from dir for that one runtime.
function candidateRuntimes({ home, env = {} }) {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  const definitions = [
    { id: "claude", dir: env.CLAUDE_CONFIG_DIR || join(home, ".claude"), bootstrap: "hook" },
    { id: "copilot", dir: env.COPILOT_HOME || join(home, ".copilot"), bootstrap: "agents" },
    {
      id: "codex",
      dir: join(home, ".agents"),
      agentsDir: env.CODEX_HOME || join(home, ".codex"),
      bootstrap: "agents",
      experimental: true,
    },
    {
      id: "opencode",
      dir: env.OPENCODE_CONFIG_DIR || join(xdg, "opencode"),
      bootstrap: "agents",
    },
  ];
  return definitions.map((runtime) => ({
    ...runtime,
    skills: join(runtime.dir, "skills"),
    settingsFile: join(runtime.dir, "settings.json"),
    agentsFile: join(runtime.agentsDir || runtime.dir, "AGENTS.md"),
  }));
}

// Detected runtimes: present only if the agent's config dir already exists. We
// never create an agent home that isn't there.
export function resolveRuntimes({ home, env = {} }) {
  return candidateRuntimes({ home, env }).filter((rt) => existsSync(rt.dir));
}

// Skill names = immediate subdirectories of the source skills/ dir.
// Skills are skills/* dirs that carry a SKILL.md. A dir without one is a shared
// lib (see listSharedLibs), not a skill -- so it never gets prefixed, rendered,
// routed, or listed.
export function listSkills(skillsSource) {
  return readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(skillsSource, entry.name, "SKILL.md")))
    .map((entry) => entry.name);
}

// Shared libs are skills/* dirs with NO SKILL.md -- helper modules a skill
// imports via a relative `../<name>/` path. Copied verbatim under their source
// name (which must already carry the `slynk-` prefix, so the relative import
// resolves identically in link + copy mode and uninstall's prefix sweep cleans
// them). An unprefixed one is a clobber risk and is skipped by install().
export function listSharedLibs(skillsSource) {
  return readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !existsSync(join(skillsSource, entry.name, "SKILL.md")))
    .map((entry) => entry.name);
}

// --- bootstrap session hook (the skill router) ---------------------------
//
// One aggressive router nudge, auto-installed machine-wide. Claude Code gets a
// SessionStart hook; the others get a managed block in their global AGENTS.md.
// No dial: "dial back" = edit the source text below and reinstall.

// AGENTS.md region markers. The block is located by these so reinstall replaces
// it in place and uninstall removes only our region.
const AGENTS_START =
  "<!-- slynk:bootstrap:start (managed by slynk-toolkit; edit via reinstall) -->";
const AGENTS_END = "<!-- slynk:bootstrap:end -->";

// The hook script's filename, used both to copy it and as the idempotency key in
// settings.json (any SessionStart command referencing it is ours -- copy mode at
// <config>/slynk/, link mode at the clone's hooks/).
const HOOK_SCRIPT = "bootstrap-hook.mjs";

// Curated trigger -> skill routes for the AGENTS.md block (slim phrasing). The CC
// hook script carries its own richer copy; keep the two in sync if you edit either.
const ROUTES = [
  { skill: "brainstorm", when: "fuzzy idea" },
  { skill: "spec", when: "ready to build" },
  { skill: "create-pr", when: "shipping" },
  { skill: "handoff", when: "wrapping up" },
];

let temporaryCounter = 0;

// Write atomically and symlink-safely: resolve the real target (so a dotfiles
// symlink stays a symlink), write a sibling temp file, rename over it.
function atomicWrite(targetPath, contents) {
  const real = existsSync(targetPath) ? realpathSync(targetPath) : targetPath;
  mkdirSync(dirname(real), { recursive: true });
  const temporary = join(
    dirname(real),
    `.${basename(real)}.slynk-${process.pid}-${temporaryCounter++}`,
  );
  writeFileSync(temporary, contents);
  renameSync(temporary, real);
}

// Build the AGENTS.md block listing only installed routes, or null if none.
export function buildAgentsBlock(installedSkills) {
  const rows = ROUTES.filter((route) => installedSkills.includes(route.skill)).map(
    (route) => `${route.when} -> ${PREFIX}${route.skill}`,
  );
  if (rows.length === 0) return null;
  return [
    AGENTS_START,
    "",
    "## slynk skills",
    "",
    "Prefer a slynk skill over ad-hoc work when the moment fits:",
    `${rows.join(", ")}. See each skill for detail.`,
    "",
    AGENTS_END,
  ].join("\n");
}

// Upsert the managed region: replace between markers if present, else append.
// User content before/after the region is preserved verbatim (trimmed at the seam).
function upsertRegion(existing, block) {
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  let before = existing;
  let after = "";
  if (start !== -1 && end !== -1 && end > start) {
    before = existing.slice(0, start);
    after = existing.slice(end + AGENTS_END.length);
  }
  return (
    [before.trimEnd(), block, after.trimStart()].filter((part) => part.length > 0).join("\n\n") +
    "\n"
  );
}

// Remove only the managed region, collapsing the seam. No region -> unchanged.
function clearRegion(existing) {
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  if (start === -1 || end === -1 || end < start) return existing;
  const parts = [
    existing.slice(0, start).trimEnd(),
    existing.slice(end + AGENTS_END.length).trimStart(),
  ].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join("\n\n") + "\n" : "";
}

export function writeAgentsBlock({ agentsFile, block }) {
  const existing = existsSync(agentsFile) ? readFileSync(agentsFile, "utf8") : "";
  atomicWrite(agentsFile, upsertRegion(existing, block));
}

export function removeAgentsBlock({ agentsFile }) {
  if (!existsSync(agentsFile)) return;
  atomicWrite(agentsFile, clearRegion(readFileSync(agentsFile, "utf8")));
}

// A SessionStart matcher object is ours if any of its hooks runs our script.
function isSlynkMatcher(matcher) {
  return (
    matcher &&
    Array.isArray(matcher.hooks) &&
    matcher.hooks.some((h) => typeof h?.command === "string" && h.command.includes(HOOK_SCRIPT))
  );
}

// Upsert the SessionStart hook into a parsed settings object. Matcher omitted so
// it fires on every session source (startup/resume/clear/compact).
function upsertCcHook(settings, scriptPath) {
  const entry = {
    hooks: [{ type: "command", command: `node "${toPosix(scriptPath)}"`, timeout: 10 }],
  };
  settings.hooks = settings.hooks || {};
  const sessionStart = Array.isArray(settings.hooks.SessionStart)
    ? settings.hooks.SessionStart.filter((matcher) => !isSlynkMatcher(matcher))
    : [];
  sessionStart.push(entry);
  settings.hooks.SessionStart = sessionStart;
  return settings;
}

// Write the CC SessionStart hook. Throws on malformed JSON so the caller can skip
// CC and keep going -- we never clobber a settings.json we can't parse.
export function writeCcHook({ settingsFile, scriptPath }) {
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, "utf8")) : {};
  upsertCcHook(settings, scriptPath);
  atomicWrite(settingsFile, JSON.stringify(settings, null, 2) + "\n");
}

export function removeCcHook({ settingsFile }) {
  if (!existsSync(settingsFile)) return;
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsFile, "utf8"));
  } catch {
    return; // malformed -> we never wrote here; leave it alone
  }
  if (!settings.hooks || !Array.isArray(settings.hooks.SessionStart)) return;
  settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
    (matcher) => !isSlynkMatcher(matcher),
  );
  if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  atomicWrite(settingsFile, JSON.stringify(settings, null, 2) + "\n");
}

// Place the hook script and resolve the absolute path settings.json should call.
// copy mode -> <config>/slynk/bootstrap-hook.mjs; link mode -> the clone's source.
function deployHookScript({ rt, hookSource, mode }) {
  if (mode === "link") return hookSource;
  const destination = join(rt.dir, "slynk", HOOK_SCRIPT);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(hookSource, destination);
  return destination;
}

// Wire the router nudge into every runtime. CC gets the hook (skipped, not fatal,
// on malformed settings.json); the rest get the AGENTS.md block. Returns a
// per-runtime status list for the CLI to print.
function bootstrap({ runtimes, hookSource, installedSkills, mode }) {
  const block = buildAgentsBlock(installedSkills);
  const status = [];
  for (const rt of runtimes) {
    if (rt.bootstrap === "hook") {
      try {
        const scriptPath = deployHookScript({ rt, hookSource, mode });
        writeCcHook({ settingsFile: rt.settingsFile, scriptPath });
        status.push({ id: rt.id, kind: "hook", target: rt.settingsFile });
      } catch {
        status.push({ id: rt.id, kind: "skipped", target: rt.settingsFile });
      }
    } else if (block) {
      writeAgentsBlock({ agentsFile: rt.agentsFile, block });
      status.push({ id: rt.id, kind: "agents", target: rt.agentsFile });
    }
  }
  return status;
}

// Remove every bootstrap artifact: the CC hook + its copied script, and the
// AGENTS.md block. Mirrors uninstall -- touches only slynk-owned regions/paths.
function unbootstrap({ runtimes }) {
  for (const rt of runtimes) {
    if (rt.bootstrap === "hook") {
      removeCcHook({ settingsFile: rt.settingsFile });
      rmSync(join(rt.dir, "slynk"), { recursive: true, force: true });
    } else {
      removeAgentsBlock({ agentsFile: rt.agentsFile });
    }
  }
}

// Install every skill into every runtime.
//   mode "copy" (default, published/npx): helpers ride along in the dest dir;
//     the token resolves to that dest dir.
//   mode "link" (dev from a clone): only the rendered SKILL.md is written; the
//     token points back at the clone so helper edits stay live. SKILL.md edits
//     still need a re-run.
export function install({ skillsSource, runtimes, mode = "copy", hookSource }) {
  const names = listSkills(skillsSource);
  // Split shared libs into copied (prefixed -> safe) vs skipped (unprefixed ->
  // clobber risk). Skipped names are returned and warned, never written.
  const libs = listSharedLibs(skillsSource);
  const sharedLibs = libs.filter((library) => library.startsWith(PREFIX));
  const skippedLibs = libs.filter((library) => !library.startsWith(PREFIX));
  for (const library of skippedLibs) {
    console.warn(
      `slynk-toolkit: skipping shared lib "${library}" -- a no-SKILL.md dir must be ` +
        `prefixed "${PREFIX}" to be installed (else it risks clobbering a user dir).`,
    );
  }

  for (const rt of runtimes) {
    mkdirSync(rt.skills, { recursive: true });
    for (const name of names) {
      const sourceDir = join(skillsSource, name);
      const destination = join(rt.skills, PREFIX + name);
      rmSync(destination, { recursive: true, force: true });
      mkdirSync(destination, { recursive: true });

      const slynkDir = mode === "link" ? sourceDir : destination;
      for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
        const from = join(sourceDir, entry.name);
        if (entry.name === "SKILL.md") {
          const rendered = renderSkill(readFileSync(from, "utf8"), { slynkDir, name });
          writeFileSync(join(destination, "SKILL.md"), rendered);
        } else if (mode === "copy") {
          // link mode reads helpers live from the clone via the token.
          cpSync(from, join(destination, entry.name), { recursive: true });
        }
      }
    }

    // Shared libs: copied verbatim under their source name (no prefix, no
    // render). Copy mode only -- link mode resolves `../<lib>/` within the
    // clone tree, so the importing skill's helper finds it there with no copy.
    if (mode === "copy") {
      for (const library of sharedLibs) {
        const destination = join(rt.skills, library);
        rmSync(destination, { recursive: true, force: true });
        cpSync(join(skillsSource, library), destination, { recursive: true });
      }
    }
  }
  // The bootstrap nudge ships only when the caller provides the hook script
  // source (the CLI always does); tests of pure skill-copy can omit it.
  const nudge = hookSource ? bootstrap({ runtimes, hookSource, installedSkills: names, mode }) : [];
  return {
    mode,
    skills: names,
    sharedLibs,
    skippedLibs,
    runtimes: runtimes.map((rt) => rt.id),
    nudge,
  };
}

// Remove only slynk-* entries; a user's own skills are left untouched.
export function uninstall({ runtimes }) {
  let removed = 0;
  for (const rt of runtimes) {
    let entries;
    try {
      entries = readdirSync(rt.skills);
    } catch {
      continue; // skills dir never existed -- nothing to remove
    }
    for (const entry of entries) {
      if (entry.startsWith(PREFIX)) {
        rmSync(join(rt.skills, entry), { recursive: true, force: true });
        removed++;
      }
    }
  }
  unbootstrap({ runtimes });
  return { runtimes: runtimes.map((rt) => rt.id), removed };
}
