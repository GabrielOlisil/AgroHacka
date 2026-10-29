import { describe, expect, it } from "vitest";
import { summarizeAlerts } from "../src/alert-summary";

// Tarefa 12.20: uma frase no topo da Visão geral do gestor, na ordem de prioridade.
type Alert = Parameters<typeof summarizeAlerts>[0][number];
const alert = (tipo: Alert["tipo"], nivel: Alert["nivel"]): Alert => ({ tipo, nivel });

describe("resumo dos alertas para o gestor (tarefa 12.20)", () => {
  it("sem alertas, diz que o estoque está em dia", () => {
    expect(summarizeAlerts([])).toBe("Hoje: nenhum alerta, estoque em dia.");
  });

  it("um item usa o singular", () => {
    expect(summarizeAlerts([alert("FALTA", "URGENTE")])).toBe("Hoje: 1 compra urgente.");
  });

  it("junta os grupos na ordem de prioridade, com vírgulas e 'e' no fim", () => {
    expect(
      summarizeAlerts([
        alert("PARADO", "INFORMATIVO"),
        alert("ANOMALIA", "ATENCAO"),
        alert("FALTA", "URGENTE"),
        alert("VENCIMENTO", "URGENTE"),
        alert("FALTA", "URGENTE"),
        alert("EXCESSO", "INFORMATIVO"),
        alert("PARADO", "INFORMATIVO"),
      ]),
    ).toBe(
      "Hoje: 2 compras urgentes, 1 produto vencido ou vencendo hoje, 1 retirada para conferir e 3 insumos parados ou sobrando.",
    );
  });

  it("separa o que é urgente do que dá para planejar", () => {
    expect(
      summarizeAlerts([
        alert("FALTA", "ATENCAO"),
        alert("FALTA", "ATENCAO"),
        alert("VENCIMENTO", "ATENCAO"),
        alert("CRESCENTE", "ATENCAO"),
      ]),
    ).toBe(
      "Hoje: 2 compras para planejar, 1 produto perto de vencer e 1 insumo com consumo em alta.",
    );
  });

  it("dois grupos são ligados só por 'e'", () => {
    expect(summarizeAlerts([alert("FALTA", "URGENTE"), alert("ANOMALIA", "ATENCAO")])).toBe(
      "Hoje: 1 compra urgente e 1 retirada para conferir.",
    );
  });
});
