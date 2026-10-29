import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";
import { summarizeAlerts } from "../src/alert-summary";

// Tarefa 12.23: dois cadastros com o mesmo nome, sem contar maiúsculas, acentos,
// espaços e símbolos, parecem o mesmo insumo e dividem o saldo e o consumo.
const NOW = new Date("2026-10-20T15:00:00.000Z");
const product = (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
  id,
  farmId: "f",
  nome,
  categoria: "Fertilizante",
  unidadeMedida: "sc",
  estoqueMinimo: 0,
  precoAquisicao: 10,
  validade: null,
  ...extra,
});
const duplicates = (products: ReturnType<typeof product>[]) =>
  analyzeInventory(products, [], NOW).alerts.filter((a) => a.tipo === "DUPLICADO");

describe("alerta de cadastro duplicado (tarefa 12.23)", () => {
  it("nomes iguais sem contar maiúsculas, acentos, espaços e símbolos geram um alerta de atenção", () => {
    const [alert, ...rest] = duplicates([
      product("b", "uréia  46 %", { unidadeMedida: "kg" }),
      product("a", "Ureia 46%"),
    ]);
    expect(rest).toEqual([]);
    expect(alert).toMatchObject({
      id: "DUPLICADO:a",
      productId: "a",
      nivel: "ATENCAO",
      titulo: "Ureia 46% · Possível cadastro duplicado",
    });
    expect(alert!.justificativa).toBe(
      "Os cadastros “Ureia 46%” (sc) e “uréia  46 %” (kg) parecem o mesmo insumo: os nomes só mudam em maiúsculas, acentos, espaços ou símbolos. Com cadastros separados, o saldo e o consumo ficam divididos e os alertas de cada um ficam incompletos. O que fazer: conferir os cadastros e registrar as próximas movimentações em um só.",
    );
  });

  it("três cadastros iguais geram um só alerta, com os três nomes", () => {
    const alerts = duplicates([product("c", "DIESEL"), product("a", "Diesel"), product("b", "diesel.")]);
    expect(alerts.map((a) => a.id)).toEqual(["DUPLICADO:a"]);
    expect(alerts[0]!.justificativa).toContain("“Diesel” (sc), “diesel.” (sc) e “DIESEL” (sc)");
  });

  it("nomes diferentes, um só cadastro ou lista vazia não geram alerta", () => {
    expect(duplicates([product("a", "Ureia 46%"), product("b", "Ureia 45%")])).toEqual([]);
    expect(duplicates([product("a", "Ureia")])).toEqual([]);
    expect(duplicates([])).toEqual([]);
    expect(analyzeInventory(null, null, NOW).alerts).toEqual([]);
  });

  it("cadastros de fazendas diferentes não são comparados", () => {
    expect(duplicates([product("a", "Ureia"), product("b", "Ureia", { farmId: "outra" })])).toEqual([]);
  });

  it("nomes só com símbolos não viram duplicados entre si", () => {
    expect(duplicates([product("a", "-"), product("b", "*")])).toEqual([]);
  });

  it("fica entre os alertas de atenção, depois do consumo crescente e antes dos informativos", () => {
    const alerts = analyzeInventory(
      [product("a", "Ureia"), product("b", "ureia", { estoqueMinimo: 5 })],
      [
        { id: "e", farmId: "f", productId: "a", tipo: "ENTRADA", quantidade: 10, dataMovimento: "2026-08-01T12:00:00Z", responsavel: "Ana" },
      ],
      NOW,
    ).alerts;
    expect(alerts.map((a) => a.tipo)).toEqual(["FALTA", "DUPLICADO", "PARADO"]);
  });

  it("o resumo do topo conta os cadastros para conferir", () => {
    expect(summarizeAlerts([{ tipo: "DUPLICADO", nivel: "ATENCAO" }])).toBe("Hoje: 1 cadastro para conferir.");
    expect(
      summarizeAlerts([
        { tipo: "DUPLICADO", nivel: "ATENCAO" },
        { tipo: "DUPLICADO", nivel: "ATENCAO" },
      ]),
    ).toBe("Hoje: 2 cadastros para conferir.");
  });
});
