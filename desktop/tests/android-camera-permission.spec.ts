import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  garantirPermissaoCamera,
  patchManifestFile,
} from "../src/scripts/garantir-permissao-camera";

const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)), "../");
const CAMERA = '<uses-permission android:name="android.permission.CAMERA" />';
const FEATURE =
  '<uses-feature android:name="android.hardware.camera" android:required="false" />';
const manifest = (extra = "") => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />${extra}

    <application android:label="agrohacka">
    </application>
</manifest>
`;

describe("Permissão de câmera no AndroidManifest (Tarefa 3.5)", () => {
  it("declara CAMERA e câmera opcional antes do <application>", () => {
    const result = garantirPermissaoCamera(manifest());
    expect(result).toContain(CAMERA);
    expect(result).toContain(FEATURE);
    expect(result.indexOf(CAMERA)).toBeLessThan(result.indexOf("<application"));
    expect(result.indexOf(FEATURE)).toBeLessThan(result.indexOf("<application"));
    expect(result).toContain("android.permission.INTERNET");
  });

  it("é idempotente: não duplica declarações já existentes", () => {
    const once = garantirPermissaoCamera(manifest());
    expect(garantirPermissaoCamera(once)).toBe(once);
    expect(once.match(/android\.permission\.CAMERA/g)).toHaveLength(1);
    expect(once.match(/android\.hardware\.camera/g)).toHaveLength(1);
  });

  it("completa só o que falta quando já existe apenas a permissão", () => {
    const result = garantirPermissaoCamera(manifest(`\n    ${CAMERA}`));
    expect(result.match(/android\.permission\.CAMERA/g)).toHaveLength(1);
    expect(result).toContain(FEATURE);
  });

  it("preserva finais de linha CRLF", () => {
    const result = garantirPermissaoCamera(manifest().replace(/\n/g, "\r\n"));
    expect(result).not.toMatch(/[^\r]\n/);
    expect(result).toContain(CAMERA);
  });

  it.each([
    ["texto vazio", ""],
    ["XML sem <manifest>", "<application></application>"],
    ["manifest sem <application>", "<manifest></manifest>"],
    ["valor nulo", null],
    ["valor não textual", 42],
  ])("rejeita entrada inválida: %s", (_nome, entrada) => {
    expect(() => garantirPermissaoCamera(entrada as never)).toThrow(
      /AndroidManifest/,
    );
  });

  it("patchManifestFile grava o arquivo e falha com mensagem clara se ele não existe", () => {
    const dir = mkdtempSync(join(tmpdir(), "agro-manifest-"));
    try {
      const file = join(dir, "AndroidManifest.xml");
      writeFileSync(file, manifest());
      patchManifestFile(file);
      expect(readFileSync(file, "utf-8")).toContain(CAMERA);
      expect(() => patchManifestFile(join(dir, "nao-existe.xml"))).toThrow(
        /AndroidManifest/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("workflow aplica o patch entre o init do Android e o build do .apk", () => {
    const workflow = readFileSync(
      resolve(repoRoot, ".github/workflows/build-release.yml"),
      "utf-8",
    );
    const init = workflow.indexOf("cli android init");
    const patch = workflow.indexOf("garantir-permissao-camera");
    const build = workflow.indexOf("cli android build");
    expect(init).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(init);
    expect(build).toBeGreaterThan(patch);
    expect(workflow).toContain("gen/android/app/src/main/AndroidManifest.xml");
  });
});
