#!/usr/bin/env node
// PATH shim → runs the handoff context helper, resolved relative to this file.
// See slynk-spec-context.mjs for why this is env-var free and symlink-safe.
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(resolve(here, "../skills/handoff/handoff-context.mjs")).href);
