import type { LocalStore } from "./local-store";
import type { Session, SyncPayload, SyncResponse } from "./types";

export type SyncTransport = (
  payload: SyncPayload,
  session: Session,
) => Promise<SyncResponse>;
export class SyncCoordinator {
  private running = false;
  private store: LocalStore;
  private transport: SyncTransport;
  constructor(store: LocalStore, transport: SyncTransport) {
    this.store = store;
    this.transport = transport;
  }
  async run(session: Session): Promise<SyncResponse> {
    if (this.running) throw new Error("Sincronização já em andamento.");
    this.running = true;
    try {
      const pending = await this.store.pending(session.farmId);
      // O backend atual não oferece cursor consistente; download completo evita pular registros.
      const result = await this.transport(
        {
          farmId: session.farmId,
          ...(session.deviceId ? { deviceId: session.deviceId } : {}),
          pendingMovements: pending,
        },
        session,
      );
      if (!result.sucesso || result.syncedCount !== pending.length)
        throw new Error(
          "Confirmação incompleta do lote. As pendências serão preservadas.",
        );
      await this.store.applyRemote(
        session.farmId,
        result.newProducts,
        result.newMovements,
        pending.map((m) => m.id),
      );
      await this.store.setLastSync(session.farmId, result.serverTimestamp);
      return result;
    } finally {
      this.running = false;
    }
  }
}

export async function syncWithFallback<T>(
  lan: () => Promise<T>,
  cloud: () => Promise<T>,
): Promise<T> {
  try {
    return await lan();
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
    if (status >= 400 && status < 500) throw error;
    return cloud();
  }
}
