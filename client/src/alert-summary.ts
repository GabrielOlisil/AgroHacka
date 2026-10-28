import type { InventoryAlert } from "./offline/analysis";

type SummaryAlert = Pick<InventoryAlert, "tipo" | "nivel">;

// Groups in priority order: [matches, singular, plural] (tarefa 12.20).
const GROUPS: [(a: SummaryAlert) => boolean, string, string][] = [
  [(a) => a.tipo === "FALTA" && a.nivel === "URGENTE", "compra urgente", "compras urgentes"],
  [
    (a) => a.tipo === "VENCIMENTO" && a.nivel === "URGENTE",
    "produto vencido ou vencendo hoje",
    "produtos vencidos ou vencendo hoje",
  ],
  [(a) => a.tipo === "FALTA" && a.nivel !== "URGENTE", "compra para planejar", "compras para planejar"],
  [
    (a) => a.tipo === "VENCIMENTO" && a.nivel !== "URGENTE",
    "produto perto de vencer",
    "produtos perto de vencer",
  ],
  [(a) => a.tipo === "ANOMALIA", "retirada para conferir", "retiradas para conferir"],
  [(a) => a.tipo === "CRESCENTE", "insumo com consumo em alta", "insumos com consumo em alta"],
  [
    (a) => a.tipo === "PARADO" || a.tipo === "EXCESSO",
    "insumo parado ou sobrando",
    "insumos parados ou sobrando",
  ],
];

/** One sentence for the manager: what needs action today, most urgent first. */
export function summarizeAlerts(alerts: SummaryAlert[]): string {
  const parts = GROUPS.map(([matches, one, many]) => {
    const count = alerts.filter(matches).length;
    return count === 0 ? "" : `${count} ${count === 1 ? one : many}`;
  }).filter(Boolean);
  if (parts.length === 0) return "Hoje: nenhum alerta, estoque em dia.";
  const last = parts.pop()!;
  return `Hoje: ${parts.length ? `${parts.join(", ")} e ${last}` : last}.`;
}
