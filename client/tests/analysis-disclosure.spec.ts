import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";
import type { Product, Movement } from "../src/offline/types";

const now = new Date("2026-10-16T12:00:00Z");
const product: Product = {
  id: "p",
  farmId: "f",
  nome: "Diesel",
  categoria: "Combustível",
  unidadeMedida: "L",
  estoqueMinimo: 0,
  precoAquisicao: 6,
  validade: null,
};
const entry: Movement = {
  id: "e",
  productId: "p",
  farmId: "f",
  tipo: "ENTRADA",
  quantidade: 100,
  dataMovimento: "2026-10-01T12:00:00Z",
  responsavel: "Ana",
};

describe("10.4: uncertainty and partial valuation", () => {
  it.each([1, 2])(
    "qualifies forecast alerts themselves when only %i withdrawals exist",
    (count) => {
      const result = analyzeInventory(
        [{ ...product, estoqueMinimo: 99, validade: "2026-10-17" }],
        [
          entry,
          ...Array.from({ length: count }, (_, i) => ({
            ...entry,
            id: `out${i}`,
            tipo: "SAIDA" as const,
            quantidade: 1,
            dataMovimento: "2026-10-16T10:00:00Z",
          })),
        ],
        now,
      );
      for (const tipo of ["FALTA", "VENCIMENTO", "EXCESSO"]) {
        const alert = result.alerts.find((item) => item.tipo === tipo);
        // One withdrawal predicts >90 days; two predict less, so no excess in that case.
        if (tipo === "EXCESSO" && count === 2) continue;
        expect(alert?.justificativa).toContain("Base limitada");
        expect(alert?.justificativa).toContain(`${count} retirada(s)`);
      }
    },
  );
  it.each([
    [0, "INDISPONIVEL"],
    [1, "BAIXA"],
    [2, "BAIXA"],
    [3, "MEDIA"],
    [4, "MEDIA"],
    [5, "ALTA"],
  ] as const)(
    "discloses sample size and heuristic confidence for %i withdrawals",
    (count, confiabilidade) => {
      const withdrawals: Movement[] = Array.from({ length: count }, (_, i) => ({
        ...entry,
        id: `s${i}`,
        tipo: "SAIDA",
        quantidade: 1,
        dataMovimento: `2026-10-${String(16 - i).padStart(2, "0")}T10:00:00Z`,
      }));
      const p = analyzeInventory([product], [entry, ...withdrawals], now)
        .products[0]!;
      expect(p).toMatchObject({
        amostrasConsumo: count,
        diasAmostra: Math.max(1, count),
        confiabilidade,
      });
      expect(p.diasRestantes === null).toBe(count === 0);
    },
  );
  it("does not count old/future/foreign withdrawals as recent evidence", () => {
    const movements: Movement[] = [
      entry,
      { ...entry, id: "old", tipo: "SAIDA", dataMovimento: "2026-09-01" },
      { ...entry, id: "future", tipo: "SAIDA", dataMovimento: "2026-10-17" },
      { ...entry, id: "foreign", farmId: "other", tipo: "SAIDA" },
    ];
    expect(
      analyzeInventory([product], movements, now).products[0],
    ).toMatchObject({
      amostrasConsumo: 0,
      confiabilidade: "INDISPONIVEL",
      diasRestantes: null,
    });
  });
  it("keeps missing price unknown and excludes it from ABC while qualifying the subtotal", () => {
    const unknown = { ...product, id: "unknown", precoAquisicao: null };
    const result = analyzeInventory(
      [product, unknown],
      [entry, { ...entry, id: "e2", productId: "unknown", quantidade: 10 }],
      now,
    );
    expect(result).toMatchObject({
      totalValue: 600,
      pricedProductCount: 1,
      unpricedProductCount: 1,
    });
    expect(result.products[1]).toMatchObject({
      valorEstoque: null,
      classeAbc: null,
      percentualValor: null,
    });
    expect(result.products[0]?.classeAbc).toBe("A");
  });
  it("distinguishes an explicit zero price from missing price", () => {
    const result = analyzeInventory(
      [{ ...product, precoAquisicao: 0 }],
      [entry],
      now,
    );
    expect(result).toMatchObject({
      totalValue: 0,
      pricedProductCount: 1,
      unpricedProductCount: 0,
    });
    expect(result.products[0]).toMatchObject({
      valorEstoque: 0,
      classeAbc: "C",
      percentualValor: 0,
    });
  });
  it("reports unavailable valuation when all stocked products have no price", () => {
    expect(
      analyzeInventory([{ ...product, precoAquisicao: null }], [entry], now),
    ).toMatchObject({
      totalValue: 0,
      pricedProductCount: 0,
      unpricedProductCount: 1,
    });
  });
  it.each([[], null, undefined])(
    "handles empty inputs without manufacturing missing stock or evidence",
    (items) => {
      expect(analyzeInventory(items, items, now)).toMatchObject({
        products: [],
        totalValue: 0,
        unpricedProductCount: 0,
        pricedProductCount: 0,
      });
      const p = analyzeInventory(
        [{ ...product, precoAquisicao: null }],
        [],
        now,
      );
      expect(p.unpricedProductCount).toBe(0);
      expect(p.products[0]).toMatchObject({
        saldo: 0,
        confiabilidade: "INDISPONIVEL",
        valorEstoque: null,
      });
    },
  );
  it("accepts absent price as unknown", () => {
    const { precoAquisicao: _price, ...withoutPrice } = product;
    expect(
      analyzeInventory([withoutPrice as Product], [entry], now).products[0]
        ?.valorEstoque,
    ).toBeNull();
  });
  it.each([-1, NaN, Infinity, "10"])(
    "rejects invalid price %s rather than masking it as missing",
    (price) => {
      expect(() =>
        analyzeInventory(
          [{ ...product, precoAquisicao: price } as Product],
          [entry],
          now,
        ),
      ).toThrow();
    },
  );
});
