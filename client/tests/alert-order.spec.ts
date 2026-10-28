import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";

// Tarefa 12.6: dentro de cada nível, o mais grave primeiro.
// Tipo: falta → vencimento → fora do padrão → parado → excesso.
// Falta: menos dias restantes (sem previsão por último). Vencimento: maior valor da sobra.
// Fora do padrão: maior múltiplo da média. Parado e excesso: maior valor parado.
// Empate: maior valor em estoque, depois o identificador.
const NOW = new Date("2026-10-20T15:00:00.000Z");
const at = (days: number) => new Date(Date.UTC(2026, 9, 20 + days, 12)).toISOString();

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  farmId: "f",
  nome: id,
  categoria: "Teste",
  unidadeMedida: "un",
  estoqueMinimo: 0,
  precoAquisicao: 10,
  validade: null,
  ...extra,
});
let seq = 0;
const move = (productId: string, tipo: "ENTRADA" | "SAIDA", quantidade: number, day: number) => ({
  id: `m${seq++}`,
  farmId: "f",
  productId,
  tipo,
  quantidade,
  dataMovimento: at(day),
  responsavel: "Ana",
});
const peak = (id: string, last: number) => [
  move(id, "ENTRADA", 1000, -20),
  ...[10, 10, 10, last].map((q, i) => move(id, "SAIDA", q, -4 + i)),
];

const products = [
  product("falta-5d"),
  product("falta-1d"),
  product("falta-1d-caro", { precoAquisicao: 100 }),
  product("falta-sem-uso", { estoqueMinimo: 10 }),
  product("vence-hoje", { validade: at(0) }),
  product("vence-pouco", { validade: at(10) }),
  product("vence-muito", { validade: at(10), precoAquisicao: 100 }),
  product("pico-5x"),
  product("pico-20x"),
  product("parado-barato"),
  product("parado-caro", { precoAquisicao: 100 }),
  product("parado-sem-preco", { precoAquisicao: null }),
  product("excesso"),
];
const movements = [
  move("falta-5d", "ENTRADA", 7, -10),
  move("falta-5d", "SAIDA", 2, -1),
  move("falta-1d", "ENTRADA", 3, -10),
  move("falta-1d", "SAIDA", 2, -1),
  move("falta-1d-caro", "ENTRADA", 3, -10),
  move("falta-1d-caro", "SAIDA", 2, -1),
  move("falta-sem-uso", "ENTRADA", 5, -10),
  move("vence-hoje", "ENTRADA", 5, -10),
  move("vence-pouco", "ENTRADA", 20, -10),
  move("vence-muito", "ENTRADA", 20, -10),
  ...peak("pico-5x", 50),
  ...peak("pico-20x", 200),
  move("parado-barato", "ENTRADA", 10, -40),
  move("parado-caro", "ENTRADA", 10, -40),
  move("parado-sem-preco", "ENTRADA", 10, -40),
  move("excesso", "ENTRADA", 1000, -20),
  ...Array.from({ length: 5 }, (_, i) => move("excesso", "SAIDA", 1, -5 + i)),
];

describe("ordem dos alertas por gravidade dentro de cada nível (tarefa 12.6)", () => {
  it("ordena por nível, tipo e gravidade, com desempate pelo valor em estoque", () => {
    const order = analyzeInventory(products, movements, NOW).alerts.map(
      (a) => `${a.nivel} ${a.tipo} ${a.productId}`,
    );
    expect(order).toEqual([
      "URGENTE FALTA falta-1d-caro",
      "URGENTE FALTA falta-1d",
      "URGENTE FALTA falta-5d",
      "URGENTE FALTA falta-sem-uso",
      "URGENTE VENCIMENTO vence-hoje",
      "ATENCAO VENCIMENTO vence-muito",
      "ATENCAO VENCIMENTO vence-pouco",
      "ATENCAO ANOMALIA pico-20x",
      "ATENCAO ANOMALIA pico-5x",
      "INFORMATIVO PARADO parado-caro",
      "INFORMATIVO PARADO parado-barato",
      "INFORMATIVO PARADO parado-sem-preco",
      "INFORMATIVO EXCESSO excesso",
    ]);
  });

  it("não depende da ordem em que os insumos chegam", () => {
    const view = (ps: typeof products) =>
      analyzeInventory(ps, movements, NOW).alerts.map((a) => a.id);
    expect(view([...products].reverse())).toEqual(view(products));
  });

  it("lista vazia continua sem alertas", () => {
    expect(analyzeInventory([], [], NOW).alerts).toEqual([]);
  });
});
