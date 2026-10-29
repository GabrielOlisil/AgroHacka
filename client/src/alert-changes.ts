import type { InventoryAlert } from "./offline/analysis";

type ChangeAlert = Pick<InventoryAlert, "id" | "nivel" | "titulo">;

const LEVEL = { URGENTE: "urgente", ATENCAO: "atenção", INFORMATIVO: "informativo" };

/**
 * What the reanalysis changed after a record (tarefa 12.17): new alerts, alerts
 * that changed level and resolved alerts, in that order. A new figure in the same
 * alert and level is not a change.
 */
export function describeAlertChanges(before: ChangeAlert[], after: ChangeAlert[]): string[] {
  const previous = new Map(before.map((a) => [a.id, a]));
  const current = new Set(after.map((a) => a.id));
  const created = after
    .filter((a) => !previous.has(a.id))
    .map((a) => `Novo alerta (${LEVEL[a.nivel]}): ${a.titulo}`);
  const moved = after
    .filter((a) => previous.has(a.id) && previous.get(a.id)!.nivel !== a.nivel)
    .map((a) => `Mudou de ${LEVEL[previous.get(a.id)!.nivel]} para ${LEVEL[a.nivel]}: ${a.titulo}`);
  const resolved = before.filter((a) => !current.has(a.id)).map((a) => `Resolvido: ${a.titulo}`);
  return [...created, ...moved, ...resolved];
}
