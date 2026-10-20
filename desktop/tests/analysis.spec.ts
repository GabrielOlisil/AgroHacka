import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";

const product = {
  id: "p",
  farmId: "f",
  nome: "Diesel",
  categoria: "Combustível",
  unidadeMedida: "L",
  estoqueMinimo: 10,
  precoAquisicao: 6,
  validade: null,
};
const now = new Date("2026-10-16T12:00:00Z");
const movement = (
  id: string,
  tipo: "ENTRADA" | "SAIDA",
  quantidade: number,
  date: string,
) => ({
  id,
  farmId: "f",
  productId: "p",
  tipo,
  quantidade,
  dataMovimento: date,
  responsavel: "Ana",
});

describe("análise offline do estoque", () => {
  it("calcula saldo e consumo por dias de calendário, não por quantidade de retiradas", () => {
    const result = analyzeInventory(
      [product],
      [
        movement("1", "ENTRADA", 100, "2026-10-01T12:00:00Z"),
        movement("2", "SAIDA", 10, "2026-10-07T12:00:00Z"),
        movement("3", "SAIDA", 10, "2026-10-16T10:00:00Z"),
      ],
      now,
    );
    expect(result.products[0]).toMatchObject({
      saldo: 80,
      consumoMedioDiario: 2,
      diasRestantes: 40,
      valorEstoque: 480,
    });
    expect(result.totalValue).toBe(480);
  });
  it("prioriza estoque zerado e mínimo sem inventar previsão sem histórico", () => {
    const result = analyzeInventory(
      [product],
      [movement("1", "ENTRADA", 5, "2026-10-01T12:00:00Z")],
      now,
    );
    expect(result.products[0]?.diasRestantes).toBeNull();
    expect(result.alerts[0]).toMatchObject({
      nivel: "URGENTE",
      productId: "p",
    });
    expect(result.alerts[0]?.justificativa).toMatch(/mínimo/i);
    expect(analyzeInventory([product], [], now).alerts[0]?.nivel).toBe(
      "URGENTE",
    );
  });
  it("trata vencimento por data e não dispara alerta para produto sem saldo", () => {
    const p = { ...product, validade: "2026-10-17" };
    const result = analyzeInventory(
      [p],
      [movement("1", "ENTRADA", 100, "2026-10-01T12:00:00Z")],
      now,
    );
    expect(
      result.alerts.some(
        (a) => a.tipo === "VENCIMENTO" && a.justificativa.length > 0,
      ),
    ).toBe(true);
    expect(
      analyzeInventory([p], [], now).alerts.some(
        (a) => a.tipo === "VENCIMENTO",
      ),
    ).toBe(false);
  });
  it("detecta última retirada anômala com referência explícita e não altera os arrays", () => {
    const movements = [
      movement("0", "ENTRADA", 200, "2026-10-01T12:00:00Z"),
      ...[1, 2, 3, 4].map((i) =>
        movement(
          String(i),
          "SAIDA",
          i === 4 ? 40 : 5,
          `2026-10-${10 + i}T12:00:00Z`,
        ),
      ),
    ];
    const previous = JSON.stringify(movements);
    expect(
      analyzeInventory([product], movements, now).alerts.find(
        (a) => a.tipo === "ANOMALIA",
      )?.justificativa,
    ).toMatch(/8[,.]0|8x/);
    expect(JSON.stringify(movements)).toBe(previous);
  });
  it("não soma litros com quilos e calcula ABC pelo capital armazenado", () => {
    const p2 = {
      ...product,
      id: "p2",
      unidadeMedida: "kg",
      precoAquisicao: 100,
    };
    const result = analyzeInventory(
      [product, p2],
      [
        movement("1", "ENTRADA", 10, "2026-10-01"),
        { ...movement("2", "ENTRADA", 20, "2026-10-01"), productId: "p2" },
      ],
      now,
    );
    expect(result.balancesByUnit).toEqual({ L: 10, kg: 20 });
    expect(result.products.find((p) => p.id === "p2")?.classeAbc).toBe("A");
    expect(result.totalValue).toBe(2060);
  });
  it("aceita listas vazias, nulas e preço ausente sem NaN", () => {
    expect(analyzeInventory(null, undefined, now)).toMatchObject({
      products: [],
      alerts: [],
      totalValue: 0,
    });
    expect(
      analyzeInventory([{ ...product, precoAquisicao: null }], [], now)
        .totalValue,
    ).toBe(0);
  });
  it.each([NaN, Infinity, -1])(
    "rejeita quantidades inválidas %s",
    (quantidade) => {
      expect(() =>
        analyzeInventory(
          [product],
          [movement("1", "SAIDA", quantidade, "2026-10-01")],
          now,
        ),
      ).toThrow();
    },
  );
  it("rejeita data inválida e produto sem campos essenciais", () => {
    expect(() =>
      analyzeInventory([product], [movement("1", "SAIDA", 1, "inválida")], now),
    ).toThrow();
    expect(() => analyzeInventory([{}] as never, [], now)).toThrow();
  });
});
