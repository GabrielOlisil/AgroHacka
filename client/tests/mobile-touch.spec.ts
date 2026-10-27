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

  it("o menu do celular fica embaixo, na zona do polegar, com até 4 abas de 48 px (tarefa 11.9)", () => {
    const nav = /\.sidebar nav \{([^}]*)\}/.exec(mobile)?.[1] ?? "";
    const button = /\.sidebar nav button \{([^}]*)\}/.exec(mobile)?.[1] ?? "";
    expect(nav).toMatch(/position:\s*fixed/);
    expect(nav).toMatch(/bottom:\s*0/);
    expect(button).toMatch(/min-height:\s*(4[89]|[5-9]\d)px/);
    expect(button).toMatch(/flex:\s*1 1 0/);
    // As abas que não cabem vão para "Mais"; o conteúdo não fica escondido atrás do menu.
    expect(mobile).toMatch(/\.sidebar nav \.nav-secondary \{[^}]*display:\s*none/);
    expect(mobile).toMatch(/\.sidebar nav \.nav-more \{[^}]*display:\s*flex/);
    expect(/\.main-content \{([^}]*)\}/.exec(mobile)?.[1]).toMatch(/padding-bottom/);
  });

  it("as janelas (como Novo insumo) nunca ficam mais largas que a tela", () => {
    const backdrop = /\.modal-backdrop \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(backdrop).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("campos de data/hora ficam só com o ícone nativo, que o Firefox não deixa esconder", () => {
    // Desenhar outro ícone deixava dois ícones no Firefox (sem ::-webkit-calendar-picker-indicator).
    expect(css).not.toMatch(/::-webkit-calendar-picker-indicator/);
    expect(css).not.toMatch(/input\[type="(date|time)"\] \{[^}]*background-image/);
  });

  it("fora do celular, o botão Mais e o menu dele não aparecem", () => {
    const desktop = css.slice(0, start);
    expect(desktop).toMatch(/\.nav-more,\s*\.more-menu \{[^}]*display:\s*none/);
  });

  it("o histórico vira cartões, como o estoque (tarefa 11.8)", () => {
    expect(mobile).toMatch(/\.history-panel tbody tr,?\s*[^{]*\{[^}]*display:\s*grid/);
    expect(mobile).toMatch(/\.history-panel td\[data-label\]::before/);
    expect(mobile).toMatch(/\.history-panel thead/);
  });
});
