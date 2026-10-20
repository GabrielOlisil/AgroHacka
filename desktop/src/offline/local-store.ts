import type { SqlDatabase, Statement } from "./database";
import {
  date,
  text,
  object,
  parseMovement,
  parseProduct,
  parseSession,
  sameMovement,
  type Movement,
  type MovementInput,
  type Product,
  type Session,
  type SyncResponse,
  type SyncReview,
} from "./types";

type PayloadRow = { payload: string };
const upsertProduct = (p: Product): Statement => ({
  sql: "INSERT INTO products(id, farm_id, payload) VALUES (?, ?, ?) ON CONFLICT(farm_id, id) DO UPDATE SET payload=excluded.payload",
  values: [p.id, p.farmId, JSON.stringify(p)],
});
const upsertMovement = (m: Movement): Statement => ({
  sql: "INSERT INTO movements(id, farm_id, product_id, payload) VALUES (?, ?, ?, ?) ON CONFLICT(farm_id, id) DO UPDATE SET payload=excluded.payload",
  values: [m.id, m.farmId, m.productId, JSON.stringify(m)],
});

export class LocalStore {
  readonly database: SqlDatabase;
  private writeTail: Promise<unknown> = Promise.resolve();
  constructor(database: SqlDatabase) {
    this.database = database;
  }
  private draftKey(session: Session) {
    return `movementDraft:${JSON.stringify([session.farmId, session.deviceId ?? session.userId ?? session.nome, session.role])}`;
  }
  async draftId(session: Session): Promise<string> {
    const safe = parseSession(session);
    return this.write(async () => {
      const key = this.draftKey(safe);
      await this.database.execute(
        "INSERT INTO app_config(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING",
        [key, crypto.randomUUID()],
      );
      const rows = await this.database.select<{ value: string }>(
        "SELECT value FROM app_config WHERE key=?",
        [key],
      );
      return rows[0]!.value;
    });
  }
  private write<T>(action: () => Promise<T>): Promise<T> {
    const next = this.writeTail.then(action);
    this.writeTail = next.catch(() => undefined);
    return next;
  }

  async saveSession(session: Session): Promise<void> {
    const safe = parseSession(session);
    await this.database.execute(
      "INSERT INTO app_config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      ["session", JSON.stringify(safe)],
    );
  }
  async loadSession(): Promise<Session | null> {
    const rows = await this.database.select<{ value: string }>(
      "SELECT value FROM app_config WHERE key=?",
      ["session"],
    );
    return rows[0] ? parseSession(JSON.parse(rows[0].value)) : null;
  }
  async clearSession(): Promise<void> {
    await this.database.execute("DELETE FROM app_config WHERE key=?", [
      "session",
    ]);
  }

  async snapshot(
    farmId: string,
  ): Promise<{ products: Product[]; movements: Movement[] }> {
    const [products, movements] = await Promise.all([
      this.database.select<PayloadRow>(
        "SELECT payload FROM products WHERE farm_id=? ORDER BY id",
        [farmId],
      ),
      this.database.select<PayloadRow>(
        "SELECT payload FROM movements WHERE farm_id=? ORDER BY id",
        [farmId],
      ),
    ]);
    return {
      products: products.map((row) =>
        parseProduct(JSON.parse(row.payload), farmId),
      ),
      movements: movements.map((row) =>
        parseMovement(JSON.parse(row.payload), farmId),
      ),
    };
  }
  async pending(farmId: string): Promise<Movement[]> {
    const rows = await this.database.select<PayloadRow>(
      "SELECT payload FROM sync_outbox WHERE farm_id=? ORDER BY created_at, id",
      [farmId],
    );
    return rows.map((row) => parseMovement(JSON.parse(row.payload), farmId));
  }
  async recordMovement(
    session: Session,
    input: MovementInput,
  ): Promise<Movement> {
    return this.write(async () => {
      const safe = parseSession(session);
      const value = object(input);
      const movement = parseMovement(
        {
          ...value,
          id:
            value.id === undefined
              ? crypto.randomUUID()
              : text(value.id, "identificador"),
          farmId: safe.farmId,
          responsavel: safe.nome,
          dataMovimento: value.dataMovimento,
        },
        safe.farmId,
      );
      if (Date.parse(movement.dataMovimento) > Date.now())
        throw new Error("A movimentação não pode estar no futuro.");
      const snapshot = await this.snapshot(safe.farmId);
      const existing = snapshot.movements.find((m) => m.id === movement.id);
      if (existing) {
        if (!sameMovement(existing, movement))
          throw new Error("Identificador já utilizado com outro conteúdo.");
        return existing;
      }
      if (
        (await this.syncReviews(safe.farmId)).some((r) => r.id === movement.id)
      )
        throw new Error("Identificador em revisão; não recrie a movimentação.");
      if (!snapshot.products.some((p) => p.id === movement.productId))
        throw new Error(
          "Produto não encontrado nesta fazenda. Sincronize o catálogo primeiro.",
        );
      const balance = snapshot.movements
        .filter((m) => m.productId === movement.productId)
        .reduce(
          (sum, m) =>
            sum + (m.tipo === "ENTRADA" ? m.quantidade : -m.quantidade),
          0,
        );
      if (movement.tipo === "SAIDA" && movement.quantidade > balance)
        throw new Error(
          "Quantidade maior que o saldo disponível neste aparelho.",
        );
      // Somente criações locais entram na fila. Downloads usam applyRemote.
      await this.database.transaction([
        upsertMovement(movement),
        {
          sql: "INSERT INTO sync_outbox(id, farm_id, payload, created_at) VALUES (?, ?, ?, ?)",
          values: [
            movement.id,
            safe.farmId,
            JSON.stringify(movement),
            new Date().toISOString(),
          ],
        },
        {
          sql: "DELETE FROM app_config WHERE key=? AND value=?",
          values: [this.draftKey(safe), movement.id],
        },
      ]);
      return movement;
    });
  }
  async syncReviews(farmId: string): Promise<SyncReview[]> {
    const prefix = `syncReview:${encodeURIComponent(farmId)}:`;
    const rows = await this.database.select<{ value: string }>(
      "SELECT value FROM app_config WHERE substr(key,1,?)=? ORDER BY key",
      [prefix.length, prefix],
    );
    return rows.map((row) => JSON.parse(row.value) as SyncReview);
  }
  async applySyncResponse(
    farmId: string,
    response: SyncResponse,
    submitted: Movement[],
  ): Promise<void> {
    return this.write(async () => {
      const pending = new Set((await this.pending(farmId)).map((m) => m.id));
      const terminal = new Set(response.results.map((r) => r.id));
      const statements: Statement[] = response.newProducts.map(upsertProduct);
      for (const receipt of response.results) {
        if (receipt.status !== "ACCEPTED") {
          const original = submitted.find((m) => m.id === receipt.id)!;
          const review: SyncReview = {
            id: receipt.id,
            status: receipt.status,
            message: receipt.message!,
            movement: original,
          };
          statements.push({
            sql: "INSERT INTO app_config(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            values: [
              `syncReview:${encodeURIComponent(farmId)}:${encodeURIComponent(receipt.id)}`,
              JSON.stringify(review),
            ],
          });
          statements.push({
            sql: "DELETE FROM sync_outbox WHERE farm_id=? AND id=?",
            values: [farmId, receipt.id],
          });
          statements.push({
            sql: "DELETE FROM movements WHERE farm_id=? AND id=?",
            values: [farmId, receipt.id],
          });
        }
      }
      for (const m of response.newMovements)
        if (!pending.has(m.id) || terminal.has(m.id))
          statements.push(upsertMovement(m));
      for (const receipt of response.results) {
        if (receipt.status === "ACCEPTED")
          statements.push(upsertMovement(receipt.movement!));
        statements.push({
          sql: "DELETE FROM sync_outbox WHERE farm_id=? AND id=?",
          values: [farmId, receipt.id],
        });
      }
      for (const [key, value] of [
        [`lastSync:${farmId}`, date(response.serverTimestamp)],
        [`syncDivergences:${farmId}`, JSON.stringify(response.divergences)],
      ])
        statements.push({
          sql: "INSERT INTO app_config(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          values: [key!, value!],
        });
      await this.database.transaction(statements);
    });
  }
  async applyRemote(
    farmId: string,
    products: Product[],
    movements: Movement[],
    acknowledgedIds: string[],
  ): Promise<void> {
    return this.write(async () => {
      const safeProducts = products.map((p) => parseProduct(p, farmId));
      const safeMovements = movements.map((m) => parseMovement(m, farmId));
      const pending = new Set((await this.pending(farmId)).map((m) => m.id));
      const acknowledged = new Set(acknowledgedIds);
      const statements: Statement[] = safeProducts.map(upsertProduct);
      for (const m of safeMovements)
        if (!pending.has(m.id) || acknowledged.has(m.id))
          statements.push(upsertMovement(m));
      for (const id of acknowledgedIds)
        statements.push({
          sql: "DELETE FROM sync_outbox WHERE farm_id=? AND id=?",
          values: [farmId, id],
        });
      await this.database.transaction(statements);
    });
  }
  async setLastSync(farmId: string, timestamp: string): Promise<void> {
    await this.database.execute(
      "INSERT INTO app_config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [`lastSync:${farmId}`, date(timestamp)],
    );
  }
  async lastSync(farmId: string): Promise<string | null> {
    const rows = await this.database.select<{ value: string }>(
      "SELECT value FROM app_config WHERE key=?",
      [`lastSync:${farmId}`],
    );
    return rows[0]?.value ?? null;
  }
  async saveAlerts(farmId: string, alerts: { id: string }[]): Promise<void> {
    await this.database.transaction([
      { sql: "DELETE FROM alerts WHERE farm_id=?", values: [farmId] },
      ...alerts.map((a) => ({
        sql: "INSERT INTO alerts(id, farm_id, payload) VALUES (?, ?, ?)",
        values: [a.id, farmId, JSON.stringify(a)],
      })),
    ]);
  }
}
