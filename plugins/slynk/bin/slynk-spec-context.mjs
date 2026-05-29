#!/usr/bin/env node
// PATH shim → runs the spec context helper, resolving it relative to this file.
// Env-var free: works identically under npm/npx bin-linking, the CC plugin, and
// local symlink installs. Node resolves the symlink, so import.meta.url is the
// real package path and the sibling skills/ dir is always found.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(resolve(here, "../skills/spec/spec-context.mjs")).href);
