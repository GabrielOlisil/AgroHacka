import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PERMISSION =
  '<uses-permission android:name="android.permission.CAMERA" />';
// required="false": sem câmera o app instala e o operador usa o código manual.
const FEATURE =
  '<uses-feature android:name="android.hardware.camera" android:required="false" />';
const APPLICATION = /^([ \t]*)(<application[\s>])/m;

export function garantirPermissaoCamera(xml: string): string {
  if (
    typeof xml !== "string" ||
    !/<manifest[\s>]/.test(xml) ||
    !APPLICATION.test(xml)
  )
    throw new Error(
      "AndroidManifest inválido: <manifest> e <application> são obrigatórios.",
    );
  const missing = [
    ...(xml.includes("android.permission.CAMERA") ? [] : [PERMISSION]),
    ...(xml.includes("android.hardware.camera") ? [] : [FEATURE]),
  ];
  if (!missing.length) return xml;
  const eol = xml.includes("\r\n") ? "\r\n" : "\n";
  return xml.replace(
    APPLICATION,
    (_, indent: string, tag: string) =>
      missing.map((line) => `${indent}${line}${eol}`).join("") + indent + tag,
  );
}

export function patchManifestFile(path: string): void {
  if (!existsSync(path))
    throw new Error(`AndroidManifest não encontrado em ${path}.`);
  writeFileSync(path, garantirPermissaoCamera(readFileSync(path, "utf-8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error("Uso: garantir-permissao-camera.ts <AndroidManifest.xml>");
  patchManifestFile(path);
  console.log(`Permissão de câmera garantida em ${path}`);
}
