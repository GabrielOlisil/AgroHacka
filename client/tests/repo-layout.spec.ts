import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A pasta do cliente (Tauri + Vue, Desktop e Mobile) chama-se `client`.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => {
  const file = resolve(repoRoot, path);
  expect(existsSync(file), `${path} deve existir`).toBe(true);
  return readFileSync(file, "utf-8");
};
// Caminhos da pasta antiga. `com/agrohack/desktop` (ID do pacote Android) não conta.
const oldFolder =
  /desktop\/(src|tests|scripts|README|design-system|\.gitattributes|\.env|package|src-tauri)|cd (\.\.\/|AgroHacka\/)?desktop\b|--prefix desktop|working-directory: desktop|`desktop\/`/;

describe("Layout do repositório: pasta client/", () => {
  it("o cliente vive em client/ e a pasta desktop/ não existe mais", () => {
    expect(existsSync(resolve(repoRoot, "client/package.json"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "client/src-tauri/tauri.conf.json"))).toBe(
      true,
    );
    expect(existsSync(resolve(repoRoot, "desktop"))).toBe(false);
  });

  it("workflow usa client/ em todos os caminhos e preserva o ID do pacote Android", () => {
    const workflow = read(".github/workflows/build-release.yml");
    expect(workflow).not.toMatch(oldFolder);
    expect(workflow).toContain("working-directory: client");
    expect(workflow).toContain("cache-dependency-path: client/package-lock.json");
    expect(workflow).toContain("client/src-tauri/target/release/bundle/nsis/*.exe");
    expect(workflow).toContain("client/src-tauri/gen/android/app/build/outputs/apk/");
    // o identificador do app (e da MainActivity) não muda: renomear trocaria a identidade no Android
    expect(workflow).toContain("java/com/agrohack/desktop/MainActivity.kt");
  });

  it("scripts da raiz apontam para client/ e usam o script tauri:dev", () => {
    const { scripts } = JSON.parse(read("package.json"));
    expect(scripts["test:client"]).toBe("npm --prefix client test");
    expect(scripts["dev:client"]).toBe("npm --prefix client run tauri:dev");
    expect(scripts["test:desktop"]).toBeUndefined();
    expect(scripts["dev:desktop"]).toBeUndefined();
  });

  it("teste de integração da API importa o cliente de client/", () => {
    const source = read("api/test/sync.postgres.integration.ts");
    expect(source).not.toMatch(/\.\.\/desktop\//);
    expect(source).toContain("../../client/src/offline/local-store");
    expect(source).toContain("../client/src-tauri/migrations/001_offline.sql");
  });

  it.each([
    "README.md",
    "regra_de_sync.md",
    "tarefas.md",
    "api/SYNC.md",
    "client/README.md",
    "client/src/api/client.ts",
  ])("%s não referencia a pasta antiga", (file) => {
    expect(read(file)).not.toMatch(oldFolder);
  });

  it("tauri.conf.json mantém o identificador com.agrohack.desktop", () => {
    const config = JSON.parse(read("client/src-tauri/tauri.conf.json"));
    expect(config.identifier).toBe("com.agrohack.desktop");
  });
});
