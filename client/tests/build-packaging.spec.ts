import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(root, "../");

describe("Empacotamento Desktop e Mobile (Etapa 5)", () => {
  it("tauri.conf.json deve manter identificador e bundle ativo", () => {
    const tauriConfPath = resolve(root, "src-tauri/tauri.conf.json");
    expect(existsSync(tauriConfPath)).toBe(true);

    const config = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
    expect(config.identifier).toBe("com.agrohack.desktop");
    expect(config.bundle.active).toBe(true);
  });

  it("versão do app (nome dos instaladores) acompanha a release de entrega e é igual no tauri.conf, Cargo.toml e Cargo.lock", () => {
    const config = JSON.parse(
      readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf-8"),
    );
    const cargo = readFileSync(resolve(root, "src-tauri/Cargo.toml"), "utf-8");
    const lock = readFileSync(resolve(root, "src-tauri/Cargo.lock"), "utf-8");
    expect(config.version).toBe("1.0.2");
    expect(cargo).toMatch(/^version = "1\.0\.2"$/m);
    expect(lock).toMatch(/name = "app"\r?\nversion = "1\.0\.2"/);
  });

  it("sincronização cloud não exige script para abrir porta no firewall", () => {
    const batPath = resolve(root, "scripts/liberar-firewall.bat");
    expect(existsSync(batPath)).toBe(false);
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

  it("workflow compila e publica somente APK debug arm64", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const android = workflow
      .split("  build-mobile-android:")[1]!
      .split("  create-release:")[0]!;
    expect(android).toMatch(
      /cli android build --apk --debug --target aarch64 --ci/,
    );
    expect(android.indexOf("actions/upload-artifact")).toBeGreaterThan(
      android.indexOf("cli android build"),
    );
    expect(android).toContain(
      "path: client/src-tauri/gen/android/app/build/outputs/apk/**/debug/*.apk",
    );
    expect(android).toContain("if-no-files-found: error");
    expect(android).not.toContain("--sign");
  });

  it("não exige chave release ou secrets Android nem mantém scripts de assinatura", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const android = workflow
      .split("  build-mobile-android:")[1]!
      .split("  create-release:")[0]!;
    expect(android).not.toMatch(
      /ANDROID_KEYSTORE|ANDROID_KEY_ALIAS|ANDROID_KEY_PASSWORD|assinar-android-release/,
    );
    expect(
      existsSync(resolve(root, "src/scripts/assinar-android-release.ts")),
    ).toBe(false);
    expect(existsSync(resolve(root, "ANDROID_RELEASE.md"))).toBe(false);
  });

  it("preserva publicação somente por tag, sem reutilizar a release de entrega", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const release = workflow.split("  create-release:")[1]!;
    expect(release).toContain("startsWith(github.ref, 'refs/tags/v')");
    expect(release).not.toContain("github.ref == 'refs/heads/main'");
    expect(release).toContain("tag_name: ${{ github.ref_name }}");
    expect(release).not.toContain("v1.0.0-entrega");
  });

  it("job Android não instala bibliotecas GTK/GLib do host: eram paliativo do `tauri dev` indevido (Tarefa 5.3)", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    expect(workflow).not.toMatch(/libglib2\.0-dev|libgtk|libwebkit2gtk/);
    expect(workflow).not.toContain("PKG_CONFIG_PATH");
  });

  it("workflow injeta VITE_API_URL de produção nos dois jobs: .env.production é ignorado pelo git e sem a URL o app abre em branco", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const header = workflow.slice(0, workflow.indexOf("\njobs:"));
    expect(header).toMatch(
      /^env:\s*\n\s+VITE_API_URL: \$\{\{ vars\.VITE_API_URL \|\| 'https:\/\/api\.arikem\.qzz\.io' \}\}/m,
    );
    expect(workflow).not.toMatch(/VITE_API_URL:.*localhost/);
  });

  it("workflow do GitHub Actions deve disparar apenas na main ou tags e conter jobs de build Windows e Android", () => {
    const workflowPath = resolve(
      repoRoot,
      ".github/workflows/build-release.yml",
    );
    expect(existsSync(workflowPath)).toBe(true);

    const workflowContent = readFileSync(workflowPath, "utf-8");
    // Restrição solicitada pelo usuário: rodar na main
    expect(workflowContent).toMatch(/branches:\s*(\n\s*-\s*main)/);
    expect(workflowContent).toContain("workflow_dispatch");
    expect(workflowContent).toContain("build-desktop-windows");
    expect(workflowContent).toContain("build-mobile-android");
  });
});
