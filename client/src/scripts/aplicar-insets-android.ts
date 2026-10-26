import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// O template do Tauri chama enableEdgeToEdge() e o WebView não recebe os insets:
// sem isto o app desenha por baixo da barra de status, da navegação e do teclado.
const IMPORTS = [
  "import androidx.core.view.ViewCompat",
  "import androidx.core.view.WindowInsetsCompat",
];
const SUPER_ON_CREATE = /^([ \t]*)super\.onCreate\(savedInstanceState\)[ \t]*$/m;

export function aplicarInsetsAndroid(kotlin: string): string {
  if (typeof kotlin !== "string" || !SUPER_ON_CREATE.test(kotlin))
    throw new Error(
      "MainActivity inválida: super.onCreate(savedInstanceState) não encontrado.",
    );
  if (kotlin.includes("setOnApplyWindowInsetsListener")) return kotlin;
  const eol = kotlin.includes("\r\n") ? "\r\n" : "\n";
  const withListener = kotlin.replace(
    SUPER_ON_CREATE,
    (call, indent: string) =>
      [
        call,
        `${indent}ViewCompat.setOnApplyWindowInsetsListener(findViewById<android.view.View>(android.R.id.content)) { view, insets ->`,
        `${indent}  val bars = insets.getInsets(`,
        `${indent}    WindowInsetsCompat.Type.systemBars() or`,
        `${indent}      WindowInsetsCompat.Type.displayCutout() or`,
        `${indent}      WindowInsetsCompat.Type.ime()`,
        `${indent}  )`,
        `${indent}  view.setPadding(bars.left, bars.top, bars.right, bars.bottom)`,
        `${indent}  WindowInsetsCompat.CONSUMED`,
        `${indent}}`,
      ].join(eol),
  );
  const missing = IMPORTS.filter((line) => !withListener.includes(line));
  if (!missing.length) return withListener;
  const anchor =
    [...withListener.matchAll(/^import .+$/gm)].at(-1) ??
    withListener.match(/^package .+$/m);
  if (!anchor || anchor.index === undefined)
    throw new Error("MainActivity inválida: sem package nem imports.");
  const end = anchor.index + anchor[0].length;
  return (
    withListener.slice(0, end) +
    eol +
    missing.join(eol) +
    withListener.slice(end)
  );
}

export function patchMainActivityFile(path: string): void {
  if (!existsSync(path))
    throw new Error(`MainActivity não encontrada em ${path}.`);
  writeFileSync(path, aplicarInsetsAndroid(readFileSync(path, "utf-8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error("Uso: aplicar-insets-android.ts <MainActivity.kt>");
  patchMainActivityFile(path);
  console.log(`Insets das barras do sistema aplicados em ${path}`);
}
