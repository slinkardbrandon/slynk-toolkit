#!/usr/bin/env node
/**
 * spec helper: Writes the spec artifact to the configured output dir.
 *
 * Usage: node write-spec-artifact.mjs --slug <slug> --content <filepath|->
 *
 * Reads content from a file path or stdin (-), writes to the configured
 * spec output directory with the date-stamped filename.
 *
 * Returns the path of the written file as JSON:
 *   { "path": "docs/specs/2026-05-29-auth-gate-links.md", "absolute": "/Users/..." }
 *
 * This saves the agent from manually doing mkdir + file creation + path resolution.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const slugIndex = args.indexOf("--slug");
const contentIndex = args.indexOf("--content");

if (slugIndex === -1 || !args[slugIndex + 1]) {
  console.error(JSON.stringify({ error: "Missing --slug argument" }));
  process.exit(1);
}

const slug = args[slugIndex + 1];
const contentSource = contentIndex === -1 ? "-" : args[contentIndex + 1];

// Get repo root
let repoRoot;
try {
  repoRoot = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
  }).trim();
} catch {
  console.error(JSON.stringify({ error: "Not inside a git repository" }));
  process.exit(1);
}

// Read spec config
const configPath = path.join(repoRoot, ".spec.yml");
let outputDir = "docs/specs";
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, "utf8");
  const match = configContent.match(/^output_dir:\s*(.+)$/m);
  if (match) outputDir = match[1].trim();
}

// Build filename
const date = new Date().toISOString().split("T")[0];
const filename = `${date}-${slug}.md`;
const fullDir = path.join(repoRoot, outputDir);
const fullPath = path.join(fullDir, filename);
const relativePath = path.join(outputDir, filename);

// Read content
let content;
content =
  contentSource === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(contentSource, "utf8");

// Prepend attribution comment
const gitName = execSync("git config user.name", { encoding: "utf8" }).trim();
const gitEmail = execSync("git config user.email", { encoding: "utf8" }).trim();
const attribution = [
  "<!--",
  `  Created with spec`,
  `  Author: ${gitName} <${gitEmail}>`,
  "-->",
  "",
  "",
].join("\n");
content = attribution + content;

// Write
fs.mkdirSync(fullDir, { recursive: true });
fs.writeFileSync(fullPath, content, "utf8");

console.log(
  JSON.stringify({
    path: relativePath,
    absolute: fullPath,
    filename,
  }),
);
