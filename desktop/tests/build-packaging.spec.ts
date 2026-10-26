import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(root, "../");

describe("Empacotamento Desktop e Mobile (Etapa 5)", () => {
  it("tauri.conf.json deve conter identificador, bundle ativo e porta local 3333", () => {
    const tauriConfPath = resolve(root, "src-tauri/tauri.conf.json");
    expect(existsSync(tauriConfPath)).toBe(true);

    const config = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
    expect(config.identifier).toBe("com.agrohack.desktop");
    expect(config.bundle.active).toBe(true);
  });

  it("script de liberação de Firewall (Tarefa 5.1) deve existir com a regra exata exigida", () => {
    const batPath = resolve(root, "scripts/liberar-firewall.bat");
    expect(existsSync(batPath)).toBe(true);

    const content = readFileSync(batPath, "utf-8");
    expect(content).toContain('name="AgroHack Local Server"');
    expect(content).toContain("protocol=TCP");
    expect(content).toContain("localport=3333");
    expect(content).toContain("profile=private");
    expect(content).toContain("netsh advfirewall firewall add rule");
  });

  it("script npm 'tauri' deve ser a CLI pura: o Gradle do Android executa `npm run tauri android android-studio-script`", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf-8"),
    );
    // Com "tauri dev", o build do .apk sobe o Vite e compila o app desktop no
    // host (cargo run), quebrando no Linux por falta do GTK (Tarefa 5.3).
    expect(pkg.scripts.tauri).toBe("tauri");
    expect(pkg.scripts["tauri:dev"]).toBe("tauri dev");
    expect(pkg.scripts["tauri:build"]).toBe("tauri build");
  });

  it("documentação e mensagem de erro apontam para npm run tauri:dev", () => {
    const docs = [
      resolve(repoRoot, "README.md"),
      resolve(root, "README.md"),
      resolve(root, "src/workspace.ts"),
    ];
    for (const file of docs) {
      const content = readFileSync(file, "utf-8");
      expect(content, file).not.toMatch(/npm run tauri(?![:\w-])/);
      expect(content, file).toContain("npm run tauri:dev");
    }
  });

  it("workflow do GitHub Actions deve disparar apenas na main ou tags e conter jobs de build Windows e Android", () => {
    const workflowPath = resolve(repoRoot, ".github/workflows/build-release.yml");
    expect(existsSync(workflowPath)).toBe(true);

    const workflowContent = readFileSync(workflowPath, "utf-8");
    // Restrição solicitada pelo usuário: rodar na main
    expect(workflowContent).toMatch(/branches:\s*(\n\s*-\s*main)/);
    expect(workflowContent).toContain("workflow_dispatch");
    expect(workflowContent).toContain("build-desktop-windows");
    expect(workflowContent).toContain("build-mobile-android");
  });
});
