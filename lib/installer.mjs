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
} from "node:fs";
import { join } from "node:path";

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
function candidateRuntimes({ home, env = {} }) {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  const definitions = [
    { id: "claude", dir: env.CLAUDE_CONFIG_DIR || join(home, ".claude") },
    { id: "copilot", dir: env.COPILOT_HOME || join(home, ".copilot") },
    { id: "codex", dir: join(home, ".agents"), experimental: true },
    { id: "opencode", dir: env.OPENCODE_CONFIG_DIR || join(xdg, "opencode") },
  ];
  return definitions.map((runtime) => ({ ...runtime, skills: join(runtime.dir, "skills") }));
}

// Detected runtimes: present only if the agent's config dir already exists. We
// never create an agent home that isn't there.
export function resolveRuntimes({ home, env = {} }) {
  return candidateRuntimes({ home, env }).filter((rt) => existsSync(rt.dir));
}

// Skill names = immediate subdirectories of the source skills/ dir.
export function listSkills(skillsSource) {
  return readdirSync(skillsSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

// Install every skill into every runtime.
//   mode "copy" (default, published/npx): helpers ride along in the dest dir;
//     the token resolves to that dest dir.
//   mode "link" (dev from a clone): only the rendered SKILL.md is written; the
//     token points back at the clone so helper edits stay live. SKILL.md edits
//     still need a re-run.
export function install({ skillsSource, runtimes, mode = "copy" }) {
  const names = listSkills(skillsSource);
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
  }
  return { mode, skills: names, runtimes: runtimes.map((rt) => rt.id) };
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
  return { runtimes: runtimes.map((rt) => rt.id), removed };
}
