import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, loadConfigFromFile } from "vite";
import { describe, expect, it, vi } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));

describe("Vite configuration", () => {
  it.each(["bundle", "native"] as const)(
    "resolves the source alias with the %s loader without native compatibility warnings",
    async (loader) => {
      const logger = createLogger("warn");
      const warning = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const result = await loadConfigFromFile(
        { command: "build", mode: "production" },
        resolve(root, "vite.config.ts"),
        root,
        "warn",
        logger,
        loader,
      );

      expect(result?.config.resolve?.alias).toEqual(
        expect.arrayContaining([{ find: "@", replacement: resolve(root, "src") }]),
      );
      expect(result?.config.server?.port).toBe(5173);
      expect(warning.mock.calls.flat().join("\n")).not.toContain(
        "unsupported by `configLoader: 'native'`",
      );
    },
  );
});
