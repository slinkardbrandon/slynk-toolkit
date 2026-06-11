#!/usr/bin/env node
/**
 * write-skill helper: scaffolds a new skill folder with a SKILL.md skeleton
 * and optional helper stubs.
 *
 * Usage:
 *   node skill-scaffold.mjs --name <kebab-name> [--root <skills-dir>] [--helper <name>]...
 *
 * --root defaults to ./skills when that dir exists (a toolkit-style repo),
 * else the cwd (a standalone skill dropped next to wherever you are).
 * Repeat --helper for multiple stubs.
 *
 * Returns JSON: { dir, files: ["SKILL.md", ...] }
 *
 * Refuses to touch an existing skill dir -- scaffolding is for new skills;
 * editing existing ones is the agent's job, not a template's.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const name = readFlag("--name");

if (!name || !isKebabCase(name))
  fail("Invalid --name: use lowercase kebab-case (letters, digits, single hyphens)");

const root = resolveRoot();
const dir = path.join(root, name);
if (fs.existsSync(dir)) fail(`Refusing to scaffold over existing dir: ${dir}`);

const helpers = readAllFlags("--helper").map((helper) => normalizeHelperName(helper));
for (const helper of helpers) {
  if (!/^[a-z0-9-]+\.mjs$/.test(helper))
    fail(`Invalid --helper "${helper}": use kebab-case, .mjs extension`);
}

const files = ["SKILL.md"];
// Wrapped so EACCES/ENOSPC reports as the same clean JSON error contract as
// every other failure -- the helper doctrine this scaffolder itself prescribes.
try {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), skillTemplate(name, helpers), "utf8");

  for (const helper of helpers) {
    fs.writeFileSync(path.join(dir, helper), helperTemplate(name, helper), "utf8");
    files.push(helper);
  }
} catch (writeError) {
  fail(`Could not write to ${dir}: ${writeError.message}`);
}

console.log(JSON.stringify({ dir, files }, null, 2));

function fail(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

// Linear-scan kebab test -- the grouped regex form is backtracking-unsafe.
function isKebabCase(value) {
  return (
    /^[a-z0-9-]+$/.test(value) &&
    !value.startsWith("-") &&
    !value.endsWith("-") &&
    !value.includes("--")
  );
}

function readFlag(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function readAllFlags(flag) {
  const values = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]);
  }
  return values;
}

function normalizeHelperName(helper) {
  return helper.endsWith(".mjs") ? helper : `${helper}.mjs`;
}

function resolveRoot() {
  const flagged = readFlag("--root");
  if (flagged) return path.resolve(flagged);
  const skillsDir = path.join(process.cwd(), "skills");
  return fs.existsSync(skillsDir) ? skillsDir : process.cwd();
}

// The skeleton encodes the doctrine so the draft starts compliant instead of
// being linted into shape: trigger-rich description, what-to-do/supporting-info
// split, {{SLYNK_DIR}} helper calls, scratch-file content passing.
function skillTemplate(skillName, helperNames) {
  const helperBlock =
    helperNames.length > 0
      ? [
          "## Phase 0 -- <load context>",
          "",
          "One helper call:",
          "",
          "```bash",
          `node "{{SLYNK_DIR}}/${helperNames[0]}"`,
          "```",
          "",
          "> `{{SLYNK_DIR}}` is the installer-expanded absolute skill dir. If the",
          "> command isn't found, the toolkit isn't installed -- run `npx slynk-toolkit`.",
          "",
        ]
      : [];

  return [
    "---",
    `name: ${skillName}`,
    "description: >-",
    "  TODO -- first sentence: what this does, in third person.",
    "  Second sentence: 'Use when ...' with the concrete trigger phrases a",
    "  router would match. Then: 'Not for X -- use <other-skill>' pointers to",
    "  keep triggers disjoint.",
    "argument-hint: TODO (optional input description)",
    "---",
    "",
    "<what-to-do>",
    "",
    "TODO -- 2-5 sentences: the job, the artifact it owns, where it stops.",
    "",
    "</what-to-do>",
    "",
    "<supporting-info>",
    "",
    "## Inputs",
    "",
    "```",
    `/${skillName}              -- TODO`,
    "```",
    "",
    ...helperBlock,
    "## TODO -- phases",
    "",
    "<!-- Config over prose, scripts over tokens: anything deterministic",
    "     (state probing, file writing, validation) belongs in a helper, not in",
    "     restated SKILL.md steps. Pass prose to helpers via a scratch file or",
    "     stdin, never `echo '...' | node`. Reference depth one level deep",
    "     (sibling FORMAT.md files), don't restate it. -->",
    "",
    "## Rules (every run)",
    "",
    "- **Own one thing.** TODO -- what this skill owns, and the named",
    "  `slynk-*` skills adjacent jobs route to.",
    "- **Cross-agent.** Gate on observed capabilities (your own tool list),",
    "  never on a runtime brand or a named tool; degrade to text-only.",
    "- **Derive, don't invent.** TODO -- the real sources this skill reads.",
    "",
    "</supporting-info>",
    "",
  ].join("\n");
}

function helperTemplate(skillName, helper) {
  return [
    "#!/usr/bin/env node",
    "/**",
    ` * ${skillName} helper: TODO -- one line on the deterministic job it does.`,
    " *",
    ` * Usage: node ${helper} [--flags]`,
    " *",
    " * Returns JSON. Dependency-free, node built-ins only. Never throws --",
    " * unreachable state reports cleanly so the skill degrades instead of",
    " * crashing.",
    " */",
    "",
    'import fs from "node:fs";',
    'import path from "node:path";',
    "",
    "// TODO",
    "console.log(JSON.stringify({ todo: true }, null, 2));",
    "",
  ].join("\n");
}
