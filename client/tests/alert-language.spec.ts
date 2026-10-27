import { describe, expect, it } from "vitest";
import { analyzeInventory } from "../src/offline/analysis";

// Tarefa 11.15: as justificativas dos alertas são lidas por produtor e operador
// rural. Sem jargão, números com vírgula. O motor da API repete estes textos
// (api/src/stock-engine/parity.spec.ts garante que são idênticos).
const NOW = new Date("2026-10-20T15:00:00.000Z");
const at = (days: number) => new Date(Date.UTC(2026, 9, 20 + days, 12)).toISOString();
const JARGON =
  /autonomia|calend[áa]rio|base limitada|crit[ée]rio|refer[êe]ncia de acompanhamento|sazonalidade|baixa confiança|\d\.\d/i;

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  farmId: "f",
  nome: id,
  categoria: "Teste",
  unidadeMedida: "L",
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

const products = [
  product("zerado", { estoqueMinimo: 5 }),
  product("minimo", { estoqueMinimo: 50 }),
  product("curto"),
  product("vencido", { validade: at(-2) }),
  product("vence", { validade: at(10) }),
  product("pico"),
  product("parado"),
  product("excesso"),
];
const movements = [
  move("zerado", "ENTRADA", 5, -10),
  move("zerado", "SAIDA", 5, -1),
  move("minimo", "ENTRADA", 60, -20),
  ...Array.from({ length: 10 }, (_, i) => move("minimo", "SAIDA", 1.5, -9 + i)),
  move("curto", "ENTRADA", 10, -5),
  move("curto", "SAIDA", 3, -1),
  move("vencido", "ENTRADA", 20, -30),
  move("vence", "ENTRADA", 50, -10),
  move("vence", "SAIDA", 1, -2),
  move("pico", "ENTRADA", 5000, -20),
  ...[60, 60, 60, 950].map((q, i) => move("pico", "SAIDA", q, -4 + i)),
  move("parado", "ENTRADA", 35, -90),
  move("excesso", "ENTRADA", 1000, -20),
  ...Array.from({ length: 5 }, (_, i) => move("excesso", "SAIDA", 1, -5 + i)),
];
const alerts = analyzeInventory(products, movements, NOW).alerts;
const text = (tipo: string, id: string) =>
  alerts.find((a) => a.tipo === tipo && a.productId === id)?.justificativa ?? "";

describe("justificativas dos alertas em linguagem simples (tarefa 11.15)", () => {
  it("cobre todos os tipos de alerta e nenhum usa jargão ou ponto decimal", () => {
    expect(new Set(alerts.map((a) => a.tipo))).toEqual(
      new Set(["FALTA", "VENCIMENTO", "ANOMALIA", "PARADO", "EXCESSO"]),
    );
    for (const alert of alerts) expect(alert.justificativa).not.toMatch(JARGON);
  });

  it("falta: diz quanto resta, o mínimo e quanto tempo dura no uso médio", () => {
    expect(text("FALTA", "zerado")).toContain("Estoque zerado");
    expect(text("FALTA", "minimo")).toMatch(/Restam .* L, no mínimo ou abaixo do mínimo de 50 L/);
    expect(text("FALTA", "minimo")).toMatch(/uso médio de 1,5 L por dia/);
    expect(text("FALTA", "minimo")).toMatch(/dura cerca de .*dia/);
  });

  it("previsão com poucas retiradas avisa que pode mudar", () => {
    expect(text("FALTA", "curto")).toMatch(/poucos dados: 1 retirada\(s\) em \d+ dia\(s\); pode mudar/);
  });

  it("validade: vencido com data em dd/mm/aaaa; perto de vencer diz quanto deve sobrar", () => {
    expect(text("VENCIMENTO", "vencido")).toMatch(/^Venceu em 18\/10\/2026, há 2 dia\(s\)\./);
    expect(text("VENCIMENTO", "vence")).toMatch(/^Vence em 10 dia\(s\); .*devem sobrar cerca de/);
  });

  it("consumo fora do padrão, estoque parado e excesso em palavras do dia a dia", () => {
    expect(text("ANOMALIA", "pico")).toMatch(/Retirada de 950 L, 15,8 vezes a média/);
    expect(text("ANOMALIA", "pico")).toContain("a partir de 3 vezes a média");
    expect(text("PARADO", "parado")).toContain("nenhuma retirada nos últimos 30 dias");
    expect(text("EXCESSO", "excesso")).toContain("época do ano");
  });
});
