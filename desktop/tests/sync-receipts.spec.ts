import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStore } from "../src/offline/local-store";
import { SyncCoordinator } from "../src/offline/sync";
import { createApi } from "../src/api/client";
import type { SqlDatabase } from "../src/offline/database";

const opened: DatabaseSync[] = [];
const session = {
  role: "OPERADOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Ana",
  deviceId: "d",
  deviceToken: "credential",
};
const product = {
  id: "p",
  farmId: "f",
  nome: "Diesel",
  categoria: "Combustível",
  unidadeMedida: "L",
  estoqueMinimo: 0,
  precoAquisicao: null,
  validade: null,
};
const input = {
  productId: "p",
  tipo: "ENTRADA" as const,
  quantidade: 10,
  dataMovimento: "2026-10-01T12:00:00.000Z",
};
function setup() {
  const db = new DatabaseSync(":memory:");
  opened.push(db);
  db.exec(
    readFileSync(
      new URL("../src-tauri/migrations/001_offline.sql", import.meta.url),
      "utf8",
    ),
  );
  const adapter: SqlDatabase = {
    async select<T>(sql: string, values = []) {
      return db.prepare(sql).all(...values) as T[];
    },
    async execute(sql, values = []) {
      db.prepare(sql).run(...values);
    },
    async transaction(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const s of statements) db.prepare(s.sql).run(...(s.values ?? []));
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const store = new LocalStore(adapter);
  return { db, store, adapter };
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe("individual cloud receipts and local recovery", () => {
  it("persists a draft identity across reopening and coalesces repeated saves with that ID", async () => {
    const { store, adapter } = setup();
    await store.applyRemote("f", [product], [], []);
    const id = await store.draftId(session);
    expect(await new LocalStore(adapter).draftId(session)).toBe(id);
    const first = await store.recordMovement(session, { ...input, id });
    expect(await store.recordMovement(session, { ...input, id })).toEqual(
      first,
    );
    expect(await store.pending("f")).toHaveLength(1);
    await expect(
      store.recordMovement(session, { ...input, id, quantidade: 11 }),
    ).rejects.toThrow(/identificador/i);
  });
  it("archives rejected attempts and applies accepted movements and last-sync atomically", async () => {
    const { store } = setup();
    await store.applyRemote("f", [product], [], []);
    const accepted = await store.recordMovement(session, input);
    const rejected = await store.recordMovement(session, input);
    const response = {
      protocolVersion: 2,
      sucesso: true,
      serverTimestamp: "2026-10-02T12:00:00.000Z",
      syncedCount: 1,
      results: [
        { id: accepted.id, status: "ACCEPTED", movement: accepted },
        {
          id: rejected.id,
          status: "VALIDATION_REJECTED",
          message: "review this attempt",
        },
      ],
      newProducts: [product],
      newMovements: [accepted],
      divergences: [],
    };
    await new SyncCoordinator(store, async () => response as never).run(
      session,
    );
    expect(await store.pending("f")).toEqual([]);
    expect((await store.snapshot("f")).movements).toEqual([accepted]);
    expect(await store.syncReviews("f")).toEqual([
      expect.objectContaining({ id: rejected.id, movement: rejected }),
    ]);
    expect(await store.lastSync("f")).toBe(response.serverTimestamp);
    await new SyncCoordinator(
      store,
      async () => ({ ...response, results: [], syncedCount: 0 }) as never,
    ).run(session);
    expect((await store.snapshot("f")).movements).toHaveLength(1);
  });
  it("rolls back receipt application if persisting last-sync fails", async () => {
    const { db, store } = setup();
    await store.applyRemote("f", [product], [], []);
    const saved = await store.recordMovement(session, input);
    db.exec(
      "CREATE TRIGGER fail_sync_timestamp BEFORE INSERT ON app_config WHEN NEW.key = 'lastSync:f' BEGIN SELECT RAISE(ABORT, 'disk failure'); END",
    );
    await expect(
      new SyncCoordinator(
        store,
        async () =>
          ({
            protocolVersion: 2,
            sucesso: true,
            results: [{ id: saved.id, status: "ACCEPTED", movement: saved }],
            syncedCount: 1,
            newProducts: [product],
            newMovements: [saved],
            divergences: [],
            serverTimestamp: "2026-10-02T12:00:00Z",
          }) as never,
      ).run(session),
    ).rejects.toThrow("disk failure");
    expect(await store.pending("f")).toHaveLength(1);
    expect(await store.lastSync("f")).toBeNull();
  });
  it.each(["missing", "repeated", "unknown", "wrong-movement"])(
    "preserves the outbox for a %s receipt",
    async (kind) => {
      const { store } = setup();
      await store.applyRemote("f", [product], [], []);
      const saved = await store.recordMovement(session, input);
      const good = { id: saved.id, status: "ACCEPTED", movement: saved };
      const results =
        kind === "missing"
          ? []
          : kind === "repeated"
            ? [good, good]
            : kind === "unknown"
              ? [{ ...good, id: "unknown" }]
              : [{ ...good, movement: { ...saved, quantidade: 999 } }];
      await expect(
        new SyncCoordinator(
          store,
          async () =>
            ({
              protocolVersion: 2,
              sucesso: true,
              results,
              syncedCount: 1,
              newProducts: [product],
              newMovements: [saved],
              divergences: [],
              serverTimestamp: "2026-10-02T12:00:00Z",
            }) as never,
        ).run(session),
      ).rejects.toThrow();
      expect(await store.pending("f")).toEqual([saved]);
    },
  );
  it("refuses a legacy response without individual confirmations", async () => {
    await expect(
      createApi("http://api.test", async () =>
        Response.json({
          sucesso: true,
          syncedCount: 0,
          serverTimestamp: "2026-10-02",
          newProducts: [],
          newMovements: [],
        }),
      ).sync({ farmId: "f" }, session),
    ).rejects.toThrow(/versão|confirma/i);
  });
  it("persists the credential returned by manual pairing for subsequent sync", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json({
        sucesso: true,
        farmId: "f",
        farmNome: "Fazenda",
        deviceId: "d",
        nomeOperador: "Ana",
        deviceToken: "returned-device-token",
      }),
    );
    expect((await api.connect({ tokenOrCode: "AGRO-1234" })).deviceToken).toBe(
      "returned-device-token",
    );
  });
});
