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
    // Tarefa 12.1: versão da final presencial (tag v1.1.5).
    expect(config.version).toBe("1.1.5");
    expect(cargo).toMatch(/^version = "1\.1\.5"$/m);
    expect(lock).toMatch(/name = "app"\r?\nversion = "1\.1\.5"/);
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

  // Tarefa 12.9: o workflow voltou a compilar Windows e Linux (ed1ab38, fa9f0f2) e
  // publica a release oficial como a mais recente; os testes abaixo seguem esse fluxo.
  it("publica Windows, Android e Linux na main e em tags, só se os três builds passarem", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const release = workflow.split("  create-release:")[1]!;
    expect(release).toContain("needs: [build-desktop-windows, build-mobile-android, build-desktop-linux]");
    for (const job of ["build-desktop-windows", "build-desktop-linux", "build-mobile-android"])
      expect(release).toContain(`needs.${job}.result == 'success'`);
    expect(release).toContain("github.ref == 'refs/heads/main'");
    expect(release).toContain("startsWith(github.ref, 'refs/tags/v')");
    expect(release).toContain("fail_on_unmatched_files: true");
    for (const files of [
      "release-assets/android/**/*.apk",
      "release-assets/windows/**/*.exe",
      "release-assets/windows/**/*.msi",
      "release-assets/linux/**/*.AppImage",
    ])
      expect(release).toContain(files);
    expect(release).not.toContain("v1.0.0-entrega");
  });

  it("vincula a release ao commit compilado, usa tag exclusiva por execução e a marca como a mais recente", () => {
    const workflow = readFileSync(resolve(repoRoot, ".github/workflows/build-release.yml"), "utf-8");
    const release = workflow.split("  create-release:")[1]!;
    expect(release).toContain("tag_name: ${{ startsWith(github.ref, 'refs/tags/v') && github.ref_name || format('android-build-{0}', github.run_number) }}");
    expect(release).toContain("target_commitish: ${{ github.sha }}");
    expect(release).toContain("prerelease: false");
    expect(release).toContain("make_latest: true");
  });

  it("job Android não instala bibliotecas GTK/GLib do host: eram paliativo do `tauri dev` indevido (Tarefa 5.3); só o job Linux precisa delas", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const android = workflow
      .split("  build-mobile-android:")[1]!
      .split("  create-release:")[0]!;
    const linux = workflow
      .split("  build-desktop-linux:")[1]!
      .split("  build-mobile-android:")[0]!;
    expect(android).not.toMatch(/libglib2\.0-dev|libgtk|libwebkit2gtk/);
    expect(linux).toContain("libwebkit2gtk-4.1-dev");
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

  it("workflow dispara na main ou tags e compila Windows, Linux e Android", () => {
    const workflowPath = resolve(
      repoRoot,
      ".github/workflows/build-release.yml",
    );
    expect(existsSync(workflowPath)).toBe(true);

    const workflowContent = readFileSync(workflowPath, "utf-8");
    // Restrição solicitada pelo usuário: rodar na main
    expect(workflowContent).toMatch(/branches:\s*(\n\s*-\s*main)/);
    expect(workflowContent).toContain("workflow_dispatch");
    expect(workflowContent).toMatch(/^  build-desktop-windows:/m);
    expect(workflowContent).toMatch(/^  build-desktop-linux:/m);
    expect(workflowContent).toMatch(/^  build-mobile-android:/m);
  });
});

describe("integração contínua dos testes (tarefa 12.9)", () => {
  const ci = () => readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf-8");

  it("roda os testes e a checagem de tipos do cliente, não só os da API", () => {
    const client = ci().split("  test-client:")[1];
    expect(client, "job test-client").toBeDefined();
    expect(client).toContain("working-directory: client");
    expect(client).toContain("run: npm ci");
    expect(client).toContain("run: npm test");
    expect(client).toContain("run: npm run check");
    // .env.test não é versionado: o job dá a URL só para os testes (o fetch é simulado).
    expect(client).toMatch(/VITE_API_URL: http:\/\/localhost:3000/);
  });

  it("roda nos PRs e pushes da dev, para onde vão todas as mudanças, além da main", () => {
    const header = ci().slice(0, ci().indexOf("\njobs:"));
    const push = header.split("pull_request:")[0]!;
    const pr = header.split("pull_request:")[1]!;
    for (const section of [push, pr]) {
      expect(section).toMatch(/^\s+- main$/m);
      expect(section).toMatch(/^\s+- dev$/m);
    }
  });
});
