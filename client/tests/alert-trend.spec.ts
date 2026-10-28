import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";

// Tarefa 12.7, item 23 do parecer:
// - fora do padrão olha todas as retiradas da janela de 30 dias, não só a última;
// - consumo crescente: uso médio por dia dos últimos 15 dias pelo menos 50% acima
//   do uso médio dos 15 anteriores, com 2 ou mais retiradas em cada metade. A metade
//   anterior conta a partir da primeira retirada, para não confundir início de uso com aumento.
const NOW = new Date("2026-10-20T15:00:00.000Z");
const at = (days: number) => new Date(Date.UTC(2026, 9, 20 + days, 12)).toISOString();

const product = (id: string) => ({
  id,
  farmId: "f",
  nome: id,
  categoria: "Teste",
  unidadeMedida: "un",
  estoqueMinimo: 0,
  precoAquisicao: 10,
  validade: null,
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
// Stock high enough that no shortage alert gets in the way.
const outs = (id: string, items: [quantity: number, day: number][]) => [
  move(id, "ENTRADA", 10_000, -40),
  ...items.map(([q, d]) => move(id, "SAIDA", q, d)),
];
const alertsOf = (id: string, items: [number, number][]) =>
  analyzeInventory([product(id)], outs(id, items), NOW).alerts;
const find = (id: string, tipo: string, items: [number, number][]) =>
  alertsOf(id, items).find((a) => a.tipo === tipo);

describe("fora do padrão em toda a janela (tarefa 12.7)", () => {
  it("acha o pico mesmo quando ele não é a última retirada, e diz a data", () => {
    const alert = find("meio", "ANOMALIA", [[10, -6], [10, -5], [10, -4], [200, -3], [10, -2]]);
    expect(alert?.justificativa).toMatch(
      /^Retirada de 200 un em 17\/10\/2026, 20 vezes a média das 3 retiradas anteriores \(10 un\)\./,
    );
  });

  it("com dois picos, aponta o maior em relação à média de antes dele", () => {
    const alert = find("dois", "ANOMALIA", [
      [10, -8], [10, -7], [10, -6], [50, -5], [10, -4], [10, -3], [300, -2],
    ]);
    expect(alert?.justificativa).toMatch(/^Retirada de 300 un em 18\/10\/2026, 18 vezes a média das 6 retiradas anteriores/);
  });

  it("com menos de 3 retiradas antes, não há base para comparar", () => {
    expect(find("poucas", "ANOMALIA", [[10, -4], [10, -3], [200, -2]])).toBeUndefined();
  });

  it("abaixo de 3 vezes a média não é fora do padrão", () => {
    expect(find("normal", "ANOMALIA", [[10, -5], [10, -4], [10, -3], [29, -2]])).toBeUndefined();
  });
});

describe("consumo crescente (tarefa 12.7)", () => {
  // Metade anterior: 4 retiradas de 5 un entre -28 e -16, contadas de -28 a -15 (14 dias).
  const before: [number, number][] = [[5, -28], [5, -24], [5, -20], [5, -16]];

  it("avisa quando o uso por dia sobe 50% ou mais, com a conta e o que fazer", () => {
    const recent: [number, number][] = [[10, -12], [10, -10], [10, -8], [10, -6], [10, -4], [10, -2]];
    const alert = find("sobe", "CRESCENTE", [...before, ...recent]);
    expect(alert?.nivel).toBe("ATENCAO");
    expect(alert?.titulo).toBe("sobe · Consumo crescente");
    expect(alert?.justificativa).toBe(
      "O uso médio subiu de 1,43 un por dia para 4 un por dia nos últimos 15 dias, 180% a mais que nos 15 dias anteriores. Consideramos crescente a partir de 50% a mais. O que fazer: conferir se o aumento era esperado e antecipar a próxima compra se ele continuar.",
    );
  });

  it("exatamente 50% a mais já conta como crescente", () => {
    // Anterior: 28 un em 14 dias = 2/dia. Recente: 45 un em 15 dias = 3/dia.
    const items: [number, number][] = [[7, -28], [7, -24], [7, -20], [7, -16], [15, -10], [15, -6], [15, -2]];
    expect(find("limite", "CRESCENTE", items)?.justificativa).toContain("50% a mais");
  });

  it("menos de 50% a mais não avisa", () => {
    // Anterior: 1,43/dia. Recente: 30 un em 15 dias = 2/dia (40% a mais).
    const recent: [number, number][] = [[10, -10], [10, -6], [10, -2]];
    expect(find("pouco", "CRESCENTE", [...before, ...recent])).toBeUndefined();
  });

  it("exige pelo menos 2 retiradas em cada metade", () => {
    const recent: [number, number][] = [[50, -10], [50, -2]];
    expect(find("uma", "CRESCENTE", [[5, -20], ...recent])).toBeUndefined();
    expect(find("recente-uma", "CRESCENTE", [...before, [100, -2]])).toBeUndefined();
  });

  it("início de uso no fim da metade anterior não é aumento", () => {
    // Retiradas diárias de 5 un desde -17: 5/dia antes e cerca de 4,7/dia depois.
    const daily: [number, number][] = Array.from({ length: 17 }, (_, i) => [5, -17 + i]);
    expect(find("comeco", "CRESCENTE", daily)).toBeUndefined();
  });

  it("no nível de atenção, vem depois do fora do padrão", () => {
    const items: [number, number][] = [...before, [10, -12], [10, -10], [10, -8], [10, -6], [10, -4], [100, -2]];
    const tipos = alertsOf("ambos", items)
      .filter((a) => a.nivel === "ATENCAO")
      .map((a) => a.tipo);
    expect(tipos).toEqual(["ANOMALIA", "CRESCENTE"]);
  });
});
