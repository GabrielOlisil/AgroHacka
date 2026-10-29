import { describe, expect, it } from "vitest";
import { describeAlertChanges } from "../src/alert-changes";

// Tarefa 12.17: depois de salvar, a tela diz o que a reanálise mudou.
type A = Parameters<typeof describeAlertChanges>[0][number] & { justificativa: string };
const alert = (id: string, nivel: A["nivel"], titulo = id, justificativa = "…"): A => ({
  id,
  nivel,
  titulo,
  justificativa,
});

describe("o que mudou nos alertas depois do registro (tarefa 12.17)", () => {
  it("lista alertas novos, que mudaram de nível e resolvidos, nessa ordem", () => {
    const before = [alert("FALTA:a", "ATENCAO", "A · Reposição"), alert("FALTA:b", "URGENTE", "B · Reposição")];
    const after = [alert("FALTA:a", "URGENTE", "A · Reposição"), alert("ANOMALIA:c", "ATENCAO", "C · Consumo fora do padrão")];
    expect(describeAlertChanges(before, after)).toEqual([
      "Novo alerta (atenção): C · Consumo fora do padrão",
      "Mudou de atenção para urgente: A · Reposição",
      "Resolvido: B · Reposição",
    ]);
  });

  it("um alerta que só mudou a conta, no mesmo nível, não conta como mudança", () => {
    const before = [alert("FALTA:a", "URGENTE", "A · Reposição", "Restam 10")];
    const after = [alert("FALTA:a", "URGENTE", "A · Reposição", "Restam 8")];
    expect(describeAlertChanges(before, after)).toEqual([]);
  });

  it("listas vazias não têm mudança; a primeira análise mostra tudo como novo", () => {
    expect(describeAlertChanges([], [])).toEqual([]);
    expect(describeAlertChanges([], [alert("PARADO:x", "INFORMATIVO", "X · Estoque parado")])).toEqual([
      "Novo alerta (informativo): X · Estoque parado",
    ]);
  });
});
