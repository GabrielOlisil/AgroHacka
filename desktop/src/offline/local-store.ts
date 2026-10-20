import type { SqlDatabase, Statement } from "./database";
import {
  date,
  object,
  parseMovement,
  parseProduct,
  parseSession,
  type Movement,
  type MovementInput,
  type Product,
  type Session,
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
          id: crypto.randomUUID(),
          farmId: safe.farmId,
          responsavel: safe.nome,
          dataMovimento: value.dataMovimento,
        },
        safe.farmId,
      );
      if (Date.parse(movement.dataMovimento) > Date.now())
        throw new Error("A movimentação não pode estar no futuro.");
      const snapshot = await this.snapshot(safe.farmId);
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
      ]);
      return movement;
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
