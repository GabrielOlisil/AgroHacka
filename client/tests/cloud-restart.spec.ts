import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { LocalStore } from "../src/offline/local-store";
import type { SqlDatabase, SqlValue } from "../src/offline/database";
import type { Movement, SyncPayload } from "../src/offline/types";
import { createWorkspace } from "../src/workspace";

const databases = new Set<DatabaseSync>();
const directories: string[] = [];
function open(path: string, initialize = false) {
  const db = new DatabaseSync(path);
  databases.add(db);
  db.exec("PRAGMA foreign_keys=ON");
  if (initialize)
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
        for (const statement of statements)
          db.prepare(statement.sql).run(...(statement.values ?? []));
        db.exec("COMMIT");
      } catch (cause) {
        db.exec("ROLLBACK");
        throw cause;
      }
    },
  };
  return {
    db,
    store: new LocalStore(adapter),
    close() {
      db.close();
      databases.delete(db);
    },
  };
}
afterEach(() => {
  for (const db of databases) db.close();
  databases.clear();
  for (const path of directories.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe("10.5: durable cloud synchronization after restart (real temporary SQLite)", () => {
  it("retains the session and UUID offline, then retries a lost cloud response without a second debit", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agrohack-cloud-restart-"));
    directories.push(dir);
    const path = join(dir, "local.db");
    let local = open(path, true);
    const session = {
      role: "OPERADOR",
      farmId: "f",
      farmNome: "Fazenda",
      nome: "Ana",
      deviceId: "d",
      deviceToken: "tok_demo",
      localIp: "192.168.1.100",
      localPort: 3333,
    };
    local.db
      .prepare("INSERT INTO app_config(key,value) VALUES (?,?)")
      .run("session", JSON.stringify(session));
    const product = {
      id: "p",
      farmId: "f",
      nome: "Diesel",
      categoria: "Combustível",
      unidadeMedida: "L",
      estoqueMinimo: 0,
      precoAquisicao: 6,
      validade: null,
    };
    const entry: Movement = {
      id: "entry",
      farmId: "f",
      productId: "p",
      tipo: "ENTRADA",
      quantidade: 100,
      dataMovimento: "2026-10-01T12:00:00.000Z",
      responsavel: "Gestor",
    };
    await local.store.applyRemote("f", [product], [entry], []);
    let online = false,
      loseResponse = true;
    const cloud = new Map([[entry.id, entry]]);
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe("https://cloud.test/sync");
      expect(request.headers.get("X-Device-Token")).toBe("tok_demo");
      const payload = (await request.json()) as SyncPayload;
      if (!online) throw new TypeError("offline");
      for (const movement of payload.pendingMovements ?? [])
        cloud.set(movement.id, movement);
      if (loseResponse) {
        loseResponse = false;
        throw new TypeError("response lost after commit");
      }
      return Response.json({
        protocolVersion: 2,
        sucesso: true,
        syncedCount: payload.pendingMovements?.length ?? 0,
        results: (payload.pendingMovements ?? []).map((movement) => ({
          id: movement.id,
          status: "ACCEPTED",
          movement,
        })),
        divergences: [],
        newProducts: [product],
        newMovements: [...cloud.values()],
        serverTimestamp: "2026-10-27T12:00:00.000Z",
      });
    });
    const api = createApi("https://cloud.test", fetcher);
    const backups = {
      create: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      restore: vi.fn(),
    };
    const create = () =>
      createWorkspace({ api, backups, openStore: async () => local.store });
    let workspace = create();
    await workspace.initialize();
    await workspace.record({
      productId: "p",
      tipo: "SAIDA",
      quantidade: 10,
      dataMovimento: "2026-10-16T12:00:00.000Z",
    });
    const original = (await local.store.pending("f"))[0]!;
    await workspace.sync();
    expect(workspace.pendingCount.value).toBe(1);
    workspace.dispose();
    local.close();
    local = open(path);
    workspace = create();
    await workspace.initialize();
    expect(workspace.session.value).toMatchObject({
      deviceToken: "tok_demo",
      deviceId: "d",
    });
    expect(workspace.session.value).not.toHaveProperty("localIp");
    expect((await local.store.pending("f"))[0]).toEqual(original);
    expect(workspace.analysis.value.products[0]?.saldo).toBe(90);
    online = true;
    await workspace.sync();
    expect(workspace.pendingCount.value).toBe(1);
    expect(cloud.size).toBe(2);
    await workspace.sync();
    await workspace.sync();
    expect(workspace.error.value).toBe("");
    expect(workspace.pendingCount.value).toBe(0);
    expect(workspace.movements.value).toHaveLength(2);
    expect(workspace.confirmedBalances.value.p).toBe(90);
    expect(workspace.analysis.value.products[0]?.saldo).toBe(90);
    expect(cloud.size).toBe(2);
    workspace.dispose();
    local.close();
    local = open(path);
    workspace = create();
    await workspace.initialize();
    expect(workspace.pendingCount.value).toBe(0);
    expect(
      workspace.movements.value.filter((m) => m.id === original.id),
    ).toHaveLength(1);
    expect(workspace.analysis.value.products[0]?.saldo).toBe(90);
    workspace.dispose();
  });
});
