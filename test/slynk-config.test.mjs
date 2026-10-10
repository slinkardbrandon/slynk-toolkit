import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseSlynkYaml,
  readSpecConfig,
  readDriftConfig,
  ConfigError,
} from "../skills/slynk-mjs-utils/spec-config.mjs";

const MANIFEST = `spec:
  output_dir: docs/specs
  context_file: CONTEXT.md
drift:
  label: "agent: drift" # optional; this is the default
  notify: https://ntfy.sh/suredocs-drift-k3x9q2 # optional
  docs:
    - path: CLAUDE.md
      sources: ["package.json", "scripts/", ".github/workflows/"]
      claims: [paths, scripts]
      ignore: [] # optional; suppress residual false-positive tokens
    - path: docs/FLOWS.md
      sources: ["apps/web/src/routes/", "packages/api/src/routers/"]
    - path: docs/DECISIONS.md
      sources: ["packages/", "services/"]
      recency_only: true
`;

describe("parseSlynkYaml", () => {
  it("parses sections, scalars, flow lists, and lists of flat maps", () => {
    const parsed = parseSlynkYaml(MANIFEST);
    expect(parsed.spec).toEqual({ output_dir: "docs/specs", context_file: "CONTEXT.md" });
    expect(parsed.drift.label).toBe("agent: drift");
    expect(parsed.drift.notify).toBe("https://ntfy.sh/suredocs-drift-k3x9q2");
    expect(parsed.drift.docs).toHaveLength(3);
    expect(parsed.drift.docs[0]).toEqual({
      path: "CLAUDE.md",
      sources: ["package.json", "scripts/", ".github/workflows/"],
      claims: ["paths", "scripts"],
      ignore: [],
    });
    expect(parsed.drift.docs[2].recency_only).toBe(true);
  });

  it("parses CRLF input identically", () => {
    expect(parseSlynkYaml(MANIFEST.replaceAll("\n", "\r\n"))).toEqual(parseSlynkYaml(MANIFEST));
  });

  it("parses block lists of scalars under an item key", () => {
    const parsed = parseSlynkYaml(
      "drift:\n  docs:\n    - path: A.md\n      claims:\n        - paths\n        - scripts\n      sources:\n      - src/\n    - path: B.md\n      sources: [lib/]\n",
    );
    expect(parsed.drift.docs).toEqual([
      { path: "A.md", claims: ["paths", "scripts"], sources: ["src/"] },
      { path: "B.md", sources: ["lib/"] },
    ]);
  });

  it("reads an empty top-level key as a blank scalar, not a section", () => {
    expect(parseSlynkYaml("output_dir:\ncontext_file:\n")).toEqual({
      output_dir: "",
      context_file: "",
    });
  });

  it("reads legacy flat top-level scalars", () => {
    expect(parseSlynkYaml("output_dir: specs\ncontext_file: false\n")).toEqual({
      output_dir: "specs",
      context_file: false,
    });
  });
});

describe("unified .slynk.yml config", () => {
  let repo;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "slynk-cfg-"));
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("readSpecConfig reads the spec: section of .slynk.yml", () => {
    writeFileSync(join(repo, ".slynk.yml"), "spec:\n  output_dir: specs/unified\n");
    expect(readSpecConfig(repo)).toEqual({ outputDir: "specs/unified", contextFile: "CONTEXT.md" });
  });

  it("readSpecConfig still resolves a legacy .spec.yml", () => {
    writeFileSync(join(repo, ".spec.yml"), "output_dir: specs/legacy\n");
    expect(readSpecConfig(repo).outputDir).toBe("specs/legacy");
  });

  it("readSpecConfig defaults blank legacy keys instead of returning objects", () => {
    writeFileSync(join(repo, ".spec.yml"), "output_dir:\ncontext_file:\n");
    expect(readSpecConfig(repo)).toEqual({ outputDir: "docs/specs", contextFile: "CONTEXT.md" });
  });

  it("readSpecConfig falls back to defaults on a malformed .slynk.yml", () => {
    writeFileSync(join(repo, ".slynk.yml"), "spec:\n  not yaml we parse\n");
    expect(readSpecConfig(repo)).toEqual({ outputDir: "docs/specs", contextFile: "CONTEXT.md" });
  });

  it("readSpecConfig falls back to .spec.yml when .slynk.yml has no spec: section", () => {
    writeFileSync(join(repo, ".slynk.yml"), "drift:\n  docs:\n    - path: README.md\n");
    writeFileSync(join(repo, ".spec.yml"), "output_dir: specs/legacy\n");
    expect(readSpecConfig(repo).outputDir).toBe("specs/legacy");
  });

  it("readDriftConfig normalizes the drift: section", () => {
    writeFileSync(join(repo, ".slynk.yml"), MANIFEST);
    const config = readDriftConfig(repo);
    expect(config.label).toBe("agent: drift");
    expect(config.notify).toBe("https://ntfy.sh/suredocs-drift-k3x9q2");
    expect(config.docs[0]).toEqual({
      path: "CLAUDE.md",
      sources: ["package.json", "scripts/", ".github/workflows/"],
      claims: ["paths", "scripts"],
      recencyOnly: false,
      ignore: [],
    });
    // No claims -> all three fact classes.
    expect(config.docs[1].claims).toEqual(["paths", "scripts", "links"]);
    // recency_only -> no fact classes.
    expect(config.docs[2]).toMatchObject({ claims: [], recencyOnly: true });
  });

  it("defaults the label and leaves notify null", () => {
    writeFileSync(
      join(repo, ".slynk.yml"),
      "drift:\n  docs:\n    - path: README.md\n      sources: [src/]\n",
    );
    expect(readDriftConfig(repo)).toMatchObject({ label: "agent: drift", notify: null });
  });

  it("returns null when there is no drift: section (init guidance, not a scan)", () => {
    expect(readDriftConfig(repo)).toBeNull();
    writeFileSync(join(repo, ".slynk.yml"), "spec:\n  output_dir: docs/specs\n");
    expect(readDriftConfig(repo)).toBeNull();
  });

  const invalid = {
    "claims + recency_only":
      "      sources: [src/]\n      claims: [paths]\n      recency_only: true\n",
    "absolute source": '      sources: ["/etc/"]\n',
    "dot-dot source": '      sources: ["../other/"]\n',
    "unknown claim class": "      sources: [src/]\n      claims: [ports]\n",
    "missing sources": "      claims: [paths]\n",
    "a line the parser can't place": "      sources: [src/]\n      just some text\n",
  };
  for (const [name, extra] of Object.entries(invalid)) {
    it(`rejects ${name} with a ConfigError`, () => {
      writeFileSync(join(repo, ".slynk.yml"), `drift:\n  docs:\n    - path: README.md\n${extra}`);
      expect(() => readDriftConfig(repo)).toThrow(ConfigError);
    });
  }

  it("rejects a manifest doc under the spec output_dir (specs are point-in-time)", () => {
    writeFileSync(
      join(repo, ".slynk.yml"),
      "drift:\n  docs:\n    - path: docs/specs/2026-01-01-x.md\n",
    );
    expect(() => readDriftConfig(repo)).toThrow(/point-in-time/);
    writeFileSync(
      join(repo, ".slynk.yml"),
      "spec:\n  output_dir: plans\ndrift:\n  docs:\n    - path: plans/a.md\n",
    );
    expect(() => readDriftConfig(repo)).toThrow(ConfigError);
  });

  it("rejects a non-https notify URL", () => {
    writeFileSync(
      join(repo, ".slynk.yml"),
      "drift:\n  notify: http://ntfy.sh/x\n  docs:\n    - path: README.md\n",
    );
    expect(() => readDriftConfig(repo)).toThrow(ConfigError);
  });
});
