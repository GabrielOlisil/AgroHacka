import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(fileURLToPath(new URL("../", import.meta.url)), "src/style.css"),
  "utf-8",
);
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
  ([, selector, body]) => ({ selector: selector!.trim(), body: body! }),
);

it("contexto da estimativa quebra linha e não alarga indefinidamente a tabela", () => {
  const context = rules.find((rule) => rule.selector === ".estimate-context");
  expect(context?.body).toMatch(/white-space\s*:\s*normal/);
  expect(context?.body).toMatch(/max-width\s*:\s*28ch/);
});

describe("Botões 'Ler com a câmera' e 'Escolher imagem' (tela de conexão do operador)", () => {
  it("nenhuma regra isolada de .file-button sobrescreve fonte, altura ou padding do estilo compartilhado com .secondary", () => {
    const own = rules.filter((rule) => rule.selector === ".file-button");
    expect(own.length).toBeGreaterThan(0);
    for (const { body } of own) {
      expect(body).not.toMatch(/font-size\s*:/);
      expect(body).not.toMatch(/min-height\s*:/);
      expect(body).not.toMatch(/(^|[;\s])padding(-inline|-block)?\s*:/);
    }
  });

  it("a linha de ações estica os dois controles à mesma altura, mesmo que um deles quebre linha", () => {
    const stretch = rules.filter(
      (rule) =>
        /\.split\s*>\s*\.file-button/.test(rule.selector) &&
        /\.split\s*>\s*\.secondary/.test(rule.selector) &&
        /align-self\s*:\s*stretch/.test(rule.body),
    );
    expect(stretch).toHaveLength(1);
  });
});
