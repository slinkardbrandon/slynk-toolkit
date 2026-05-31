// @ts-check
import { defineConfig } from "eslint/config";
import unicorn from "eslint-plugin-unicorn";
import security from "eslint-plugin-security";

export default defineConfig([
  {
    ignores: ["**/node_modules/**", ".claude/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [unicorn.configs.recommended],
    rules: {
      // .mjs scripts run directly via node — these defaults fight that, not help it.
      "unicorn/filename-case": "off",
      "unicorn/no-null": "off",
      // Named node: imports read fine and match the rest of the code; the churn isn't worth it.
      "unicorn/import-style": "off",
      "unicorn/prevent-abbreviations": [
        "error",
        {
          replacements: {
            env: false,
            fn: false,
            db: false,
            doc: false,
            docs: false,
            args: false,
            dir: false,
          },
        },
      ],
      // Strip AI typography artifacts so output stays ASCII (matches CLAUDE.md tone rule).
      // Keys are unicode escapes so this rule can't rewrite its own config.
      "unicorn/string-content": [
        "error",
        {
          patterns: {
            "—": "--",
            "–": "-",
            "…": "...",
            "“": '"',
            "”": '"',
            "‘": "'",
            "’": "'",
          },
        },
      ],
    },
  },
  {
    // This file holds the typography patterns above as literal strings — exempt it
    // from string-content so the rule never mangles its own definition.
    files: ["eslint.config.js"],
    rules: { "unicorn/string-content": "off" },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { security },
    rules: {
      "security/detect-unsafe-regex": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-bidi-characters": "error",
    },
  },
  {
    // Installer core/CLI, skill helpers, and tests: a CLI's job IS to
    // console.log, spawn processes, and touch computed filesystem paths, and
    // the specs read/write scratch files by computed path. Relax the rules that
    // would flag this legitimate behavior. Must be last to win.
    files: ["lib/**/*.mjs", "bin/**/*.mjs", "skills/**/*.mjs", "hooks/**/*.mjs", "test/**/*.mjs"],
    rules: {
      "no-console": "off",
      "unicorn/no-process-exit": "off",
      "security/detect-child-process": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-require": "off",
    },
  },
]);
