import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aplicarInsetsAndroid,
  patchMainActivityFile,
} from "../src/scripts/aplicar-insets-android";

const root = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(root, "../");
// MainActivity.kt exatamente como o `tauri android init` gera (Tauri 2.12).
const generated = `package com.agrohack.desktop

import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }
}
`;

describe("Insets das barras do sistema no Android (edge-to-edge)", () => {
  it("aplica padding de barras, recortes e teclado na view de conteúdo após o super.onCreate", () => {
    const result = aplicarInsetsAndroid(generated);
    expect(result).toContain("import androidx.core.view.ViewCompat");
    expect(result).toContain("import androidx.core.view.WindowInsetsCompat");
    expect(result).toContain("ViewCompat.setOnApplyWindowInsetsListener(");
    expect(result).toContain("android.R.id.content");
    expect(result).toContain("WindowInsetsCompat.Type.systemBars()");
    expect(result).toContain("WindowInsetsCompat.Type.displayCutout()");
    expect(result).toContain("WindowInsetsCompat.Type.ime()");
    expect(result).toContain("view.setPadding(");
    expect(result.indexOf("super.onCreate(savedInstanceState)")).toBeLessThan(
      result.indexOf("setOnApplyWindowInsetsListener"),
    );
    // o que já existia continua lá
    expect(result).toContain("enableEdgeToEdge()");
    expect(result).toContain("class MainActivity : TauriActivity()");
  });

  it("é idempotente: aplicar duas vezes não duplica listener nem imports", () => {
    const once = aplicarInsetsAndroid(generated);
    expect(aplicarInsetsAndroid(once)).toBe(once);
    expect(once.match(/setOnApplyWindowInsetsListener/g)).toHaveLength(1);
    expect(once.match(/import androidx\.core\.view\.ViewCompat/g)).toHaveLength(
      1,
    );
  });

  it("não duplica imports que o arquivo já tinha", () => {
    const withImport = generated.replace(
      "import android.os.Bundle",
      "import android.os.Bundle\nimport androidx.core.view.ViewCompat",
    );
    const result = aplicarInsetsAndroid(withImport);
    expect(result.match(/import androidx\.core\.view\.ViewCompat/g)).toHaveLength(
      1,
    );
    expect(result).toContain("setOnApplyWindowInsetsListener");
  });

  it("preserva finais de linha CRLF", () => {
    const result = aplicarInsetsAndroid(generated.replace(/\n/g, "\r\n"));
    expect(result).not.toMatch(/[^\r]\n/);
    expect(result).toContain("setOnApplyWindowInsetsListener");
  });

  it.each([
    ["texto vazio", ""],
    ["sem super.onCreate", "class MainActivity : TauriActivity() {}"],
    ["valor nulo", null],
    ["valor não textual", 42],
  ])("rejeita entrada inválida: %s", (_nome, entrada) => {
    expect(() => aplicarInsetsAndroid(entrada as never)).toThrow(
      /MainActivity/,
    );
  });

  it("patchMainActivityFile grava o arquivo e falha com mensagem clara se ele não existe", () => {
    const dir = mkdtempSync(join(tmpdir(), "agro-activity-"));
    try {
      const file = join(dir, "MainActivity.kt");
      writeFileSync(file, generated);
      patchMainActivityFile(file);
      expect(readFileSync(file, "utf-8")).toContain(
        "setOnApplyWindowInsetsListener",
      );
      expect(() => patchMainActivityFile(join(dir, "nao-existe.kt"))).toThrow(
        /MainActivity/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("workflow aplica o patch entre o init do Android e o build, no caminho derivado do identifier do Tauri", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const { identifier } = JSON.parse(
      readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf-8"),
    );
    const init = workflow.indexOf("cli android init");
    const patch = workflow.indexOf("aplicar-insets-android");
    const build = workflow.indexOf("cli android build");
    expect(init).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(init);
    expect(build).toBeGreaterThan(patch);
    expect(workflow).toContain(
      `gen/android/app/src/main/java/${identifier.replaceAll(".", "/")}/MainActivity.kt`,
    );
  });
});
