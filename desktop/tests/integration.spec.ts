import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createApi } from "../src/api/client";
import { LocalStore } from "../src/offline/local-store";
import { SyncCoordinator } from "../src/offline/sync";
import { analyzeInventory } from "../src/offline/analysis";
import type { Movement, SyncPayload } from "../src/offline/types";
import type { SqlDatabase, SqlValue } from "../src/offline/database";

const opened: DatabaseSync[] = [];
function localStore() {
  const db = new DatabaseSync(":memory:");
  opened.push(db);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(
    readFileSync(
      new URL("../src-tauri/migrations/001_offline.sql", import.meta.url),
      "utf8",
    ),
  );
  const adapter: SqlDatabase = {
    async select<T>(sql: string, values: SqlValue[] = []) {
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
  return new LocalStore(adapter);
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

describe("integração entre SQLite, outbox, openapi-fetch e reanálise", () => {
  it("dois aparelhos trabalham offline, repetem um envio e convergem sem duplicar saídas", async () => {
    const product = {
      id: "p",
      farmId: "f",
      nome: "Diesel",
      categoria: "Combustível",
      unidadeMedida: "L",
      estoqueMinimo: 75,
      precoAquisicao: 6,
      validade: null,
    };
    const entry: Movement = {
      id: "entry",
      farmId: "f",
      productId: "p",
      tipo: "ENTRADA",
      quantidade: 100,
      dataMovimento: "2026-10-01T12:00:00Z",
      responsavel: "Gestor",
    };
    const remote = new Map<string, Movement>([[entry.id, entry]]);
    let loseResponse = true;
    const server: typeof fetch = async (input) => {
      const payload = (await (input as Request).json()) as SyncPayload;
      for (const m of payload.pendingMovements ?? []) remote.set(m.id, m);
      if (loseResponse && payload.pendingMovements?.length) {
        loseResponse = false;
        throw new TypeError("Resposta perdida após gravar no servidor");
      }
      return Response.json({
        sucesso: true,
        serverTimestamp: new Date().toISOString(),
        syncedCount: payload.pendingMovements?.length ?? 0,
        newProducts: [product],
        newMovements: [...remote.values()],
      });
    };
    const api = createApi("http://api.test", server);
    const a = localStore(),
      b = localStore();
    await a.applyRemote("f", [product], [entry], []);
    await b.applyRemote("f", [product], [entry], []);
    const ana = {
      role: "OPERADOR" as const,
      farmId: "f",
      farmNome: "Fazenda",
      nome: "Ana",
      deviceId: "a",
    };
    const bruno = { ...ana, nome: "Bruno", deviceId: "b" };
    await a.recordMovement(ana, {
      productId: "p",
      tipo: "SAIDA",
      quantidade: 10,
      dataMovimento: "2026-10-16T10:00:00Z",
    });
    await b.recordMovement(bruno, {
      productId: "p",
      tipo: "SAIDA",
      quantidade: 20,
      dataMovimento: "2026-10-16T11:00:00Z",
    });
    const syncA = new SyncCoordinator(a, api.sync),
      syncB = new SyncCoordinator(b, api.sync);
    await expect(syncA.run(ana)).rejects.toThrow(/perdida/);
    expect(await a.pending("f")).toHaveLength(1);
    await syncB.run(bruno);
    await syncA.run(ana);
    await syncB.run(bruno);
    for (const store of [a, b]) {
      const snapshot = await store.snapshot("f");
      expect(snapshot.movements).toHaveLength(3);
      expect(await store.pending("f")).toEqual([]);
      const analysis = analyzeInventory(
        snapshot.products,
        snapshot.movements,
        new Date("2026-10-16T12:00:00Z"),
      );
      expect(analysis.products[0]?.saldo).toBe(70);
      expect(analysis.alerts[0]?.nivel).toBe("URGENTE");
    }
    expect(remote.size).toBe(3);
  });
});
