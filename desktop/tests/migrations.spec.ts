import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const migrationPath = "desktop/src-tauri/migrations/001_offline.sql";
// SQLx hashes the exact SQL bytes with SHA-384, including line endings.
// This is the checksum of migration 1 originally applied with LF endings.
// Future schema changes must use a new migration, not update this checksum.
const originalChecksum =
  "2710565871cf19ccc91a8a7a8b05df399b3a1c79e2667dac745d25c0aea783abb0b3b8d7451f694af0244a9e5849ad35";

function checksum(sql: string | Buffer) {
  return createHash("sha384").update(sql).digest("hex");
}

describe("immutable SQLite migrations", () => {
  it("preserves the checksum already stored by existing installations", () => {
    const sql = readFileSync(
      new URL("../src-tauri/migrations/001_offline.sql", import.meta.url),
    );
    expect(checksum(sql)).toBe(originalChecksum);
  });

  it.each(["true", "input", "false"])(
    "keeps the original bytes on Git checkout with core.autocrlf=%s",
    (autocrlf) => {
      const sql = execFileSync(
        "git",
        [
          "-c",
          `core.autocrlf=${autocrlf}`,
          "cat-file",
          "--filters",
          `--path=${migrationPath}`,
          `HEAD:${migrationPath}`,
        ],
        { cwd: root },
      );
      expect(checksum(sql)).toBe(originalChecksum);
    },
  );

  it("enforces LF for future SQL migrations as well", () => {
    const attributes = execFileSync(
      "git",
      [
        "check-attr",
        "text",
        "eol",
        "--",
        "desktop/src-tauri/migrations/002_future.sql",
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(attributes).toContain(": text: set");
    expect(attributes).toContain(": eol: lf");
  });
});
