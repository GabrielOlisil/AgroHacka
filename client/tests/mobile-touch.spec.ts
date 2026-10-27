import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tarefa 11.6: no celular (até 760 px) os alvos de toque têm 44–48 px e o menu
// não corta nem quebra os rótulos das abas.
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf-8");
const start = css.indexOf("@media (max-width: 760px)");
const mobile = css.slice(start, css.indexOf("@media (max-width: 400px)", start));
const px = (name: string) =>
  Number(new RegExp(`${name}:\\s*(\\d+)px`).exec(mobile)?.[1] ?? 0);

describe("alvos de toque no celular (tarefa 11.6)", () => {
  it("botões e campos passam a ter pelo menos 44 px, e os principais 48 px", () => {
    expect(start).toBeGreaterThan(-1);
    expect(px("--control-md")).toBeGreaterThanOrEqual(44);
    expect(px("--control-lg")).toBeGreaterThanOrEqual(48);
  });

  it("o menu do celular tem abas de 48 px, rótulos inteiros e rola para o lado quando não cabe", () => {
    const nav = /\.sidebar nav \{([^}]*)\}/.exec(mobile)?.[1] ?? "";
    const button = /\.sidebar nav button \{([^}]*)\}/.exec(mobile)?.[1] ?? "";
    expect(nav).toMatch(/overflow-x:\s*auto/);
    expect(button).toMatch(/min-height:\s*48px/);
    expect(button).toMatch(/white-space:\s*nowrap/);
    expect(button).toMatch(/flex:\s*0 0 auto|flex:\s*none/);
  });
});
