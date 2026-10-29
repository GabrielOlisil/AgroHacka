import { describe, expect, it } from "vitest";
import { paginate, PAGE_SIZES } from "../src/pagination";

// Paginação das listas que crescem (Histórico, Estoque e Operadores).
const items = Array.from({ length: 53 }, (_, i) => i + 1);

describe("paginação das listas", () => {
  it("oferece 10, 25, 50 e 100 itens por página", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
  });

  it("devolve só os itens da página pedida, com a faixa e o total de páginas", () => {
    const page = paginate(items, 2, 25);
    expect(page.items).toEqual(items.slice(25, 50));
    expect(page).toMatchObject({ page: 2, totalPages: 3, from: 26, to: 50, total: 53 });
  });

  it("a última página pode ter menos itens", () => {
    const page = paginate(items, 3, 25);
    expect(page.items).toEqual([51, 52, 53]);
    expect(page).toMatchObject({ from: 51, to: 53 });
  });

  it("página além do fim volta para a última; página zero, negativa ou inválida vira a primeira", () => {
    expect(paginate(items, 9, 25).page).toBe(3);
    expect(paginate(items, 0, 25).page).toBe(1);
    expect(paginate(items, -2, 25).page).toBe(1);
    expect(paginate(items, Number.NaN, 25).page).toBe(1);
  });

  it("tamanho de página fora da lista usa 25", () => {
    expect(paginate(items, 1, 0).items).toHaveLength(25);
    expect(paginate(items, 1, 7).items).toHaveLength(25);
    expect(paginate(items, 1, Number.NaN).items).toHaveLength(25);
  });

  it("lista vazia tem uma página, sem itens, mostrando 0–0 de 0", () => {
    expect(paginate([], 3, 10)).toEqual({ items: [], page: 1, totalPages: 1, from: 0, to: 0, total: 0 });
  });
});
