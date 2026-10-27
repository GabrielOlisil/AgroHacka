import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O nível urgente usa um vermelho, com texto branco legível (contraste AA).
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf-8");
const hex = /--color-danger:\s*#([0-9a-f]{6})/i.exec(css)?.[1] ?? "000000";
const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const contrastWithWhite =
  1.05 / (0.2126 * luminance(r!) + 0.7152 * luminance(g!) + 0.0722 * luminance(b!) + 0.05);
const rule = (selector: string) =>
  new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";

describe("cor do nível urgente", () => {
  it("é um vermelho com contraste AA para texto branco", () => {
    expect(r! - Math.max(g!, b!)).toBeGreaterThan(80);
    expect(contrastWithWhite).toBeGreaterThanOrEqual(4.5);
  });

  it("alertas urgentes e o resumo de atenção imediata usam esse vermelho", () => {
    expect(rule(".alert-card.urgente")).toContain("var(--color-danger)");
    expect(rule(".alert-card.urgente .severity")).toContain("var(--color-danger)");
    expect(rule(".metrics article.urgent")).toContain("var(--color-danger)");
    expect(rule(".metrics article.urgent strong")).toContain("var(--color-danger)");
  });
});
