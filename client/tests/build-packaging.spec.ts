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

  it("workflow compila release arm64 e assina antes de enviar somente o APK verificado", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const android = workflow
      .split("  build-mobile-android:")[1]!
      .split("  create-release:")[0]!;
    expect(android).toMatch(/cli android build --apk --target aarch64 --ci/);
    expect(android).not.toContain("--debug");
    expect(
      android.indexOf("assinar-android-release.ts --sign"),
    ).toBeGreaterThan(android.indexOf("cli android build"));
    expect(android.indexOf("actions/upload-artifact")).toBeGreaterThan(
      android.indexOf("assinar-android-release.ts --sign"),
    );
    expect(android).toContain(
      "path: ${{ runner.temp }}/agrohacka-release/agrohacka-arm64-release.apk",
    );
    expect(android).toContain("if-no-files-found: error");
    expect(android).not.toContain("outputs/apk/**/*.apk");
    expect(android).toContain('"build-tools;35.0.0"');
  });

  it("valida credenciais antes do build e limita secrets aos passos de assinatura", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const android = workflow
      .split("  build-mobile-android:")[1]!
      .split("  create-release:")[0]!;
    const steps = android.split("      - name:");
    const preflight = steps.findIndex((step) =>
      step.includes("assinar-android-release.ts --validate-secrets"),
    );
    const build = steps.findIndex((step) => step.includes("cli android build"));
    expect(preflight).toBeGreaterThan(-1);
    expect(preflight).toBeLessThan(build);
    for (const step of steps) {
      if (step.includes("assinar-android-release.ts")) {
        for (const secret of [
          "ANDROID_KEYSTORE_BASE64",
          "ANDROID_KEY_ALIAS",
          "ANDROID_KEYSTORE_PASSWORD",
          "ANDROID_KEY_PASSWORD",
        ]) {
          expect(step).toContain(secret + ": ${{ secrets." + secret + " }}");
        }
        const run = step.slice(step.indexOf("run:"));
        expect(run).not.toContain("secrets.");
        expect(run).not.toMatch(/echo|printenv|set -x|GITHUB_ENV/);
      } else {
        expect(step).not.toContain("secrets.ANDROID_");
      }
    }
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
