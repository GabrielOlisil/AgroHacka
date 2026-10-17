import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "../src/offline/local-store";
import type { SqlDatabase, Statement } from "../src/offline/database";

const session = {
  role: "OPERADOR" as const,
  farmId: "farm-1",
  farmNome: "Boa Vista",
  nome: "Ana",
  deviceId: "device-1",
};
const product = {
  id: "product-1",
  farmId: "farm-1",
  nome: "Diesel",
  categoria: "Combustível",
  unidadeMedida: "L",
  estoqueMinimo: 10,
  precoAquisicao: 6,
  validade: null,
};
const input = {
  productId: product.id,
  tipo: "ENTRADA" as const,
  quantidade: 100,
  dataMovimento: "2026-10-10T12:00:00Z",
  destino: "",
};

describe("SQLite local e outbox", () => {
  let db: DatabaseSync;
  let store: LocalStore;
  beforeEach(async () => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
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
      async transaction(statements: Statement[]) {
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const s of statements)
            db.prepare(s.sql).run(...(s.values ?? []));
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      },
    };
    store = new LocalStore(adapter);
    await store.applyRemote(session.farmId, [product], [], []);
  });
  afterEach(() => db?.close());

  it("persiste sessão e preserva acesso offline mesmo com token expirado", async () => {
    await store.saveSession({ ...session, accessToken: "expired-token" });
    expect(await new LocalStore(store.database).loadSession()).toMatchObject({
      nome: "Ana",
      accessToken: "expired-token",
    });
  });
  it("grava movimentação e pendência juntas com UUID e responsável da sessão", async () => {
    const movement = await store.recordMovement(session, input);
    expect(movement.id).toMatch(/^[\da-f-]{36}$/i);
    expect(movement.responsavel).toBe("Ana");
    expect(await store.pending("farm-1")).toEqual([movement]);
    expect((await store.snapshot("farm-1")).movements).toHaveLength(1);
  });
  it("reverte a movimentação se a gravação da outbox falhar", async () => {
    db.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON sync_outbox BEGIN SELECT RAISE(ABORT, 'falha simulada'); END",
    );
    await expect(store.recordMovement(session, input)).rejects.toThrow(
      "falha simulada",
    );
    expect((await store.snapshot("farm-1")).movements).toEqual([]);
  });
  it.each([0, -1, NaN, Infinity, null, undefined, "10"])(
    "rejeita quantidade inválida %s sem gravar",
    async (quantidade) => {
      await expect(
        store.recordMovement(session, { ...input, quantidade } as never),
      ).rejects.toThrow();
      expect(await store.pending("farm-1")).toEqual([]);
    },
  );
  it.each([
    null,
    undefined,
    {},
    { ...input, tipo: "AJUSTE" },
    { ...input, productId: "" },
    { ...input, dataMovimento: "inválida" },
  ])("rejeita entrada incompleta/inválida", async (value) => {
    await expect(
      store.recordMovement(session, value as never),
    ).rejects.toThrow();
  });
  it("não permite produto inexistente, de outra fazenda ou retirada maior que o saldo local", async () => {
    await expect(
      store.recordMovement(session, { ...input, productId: "ausente" }),
    ).rejects.toThrow();
    await expect(
      store.recordMovement({ ...session, farmId: "outra" }, input),
    ).rejects.toThrow();
    await expect(
      store.recordMovement(session, { ...input, tipo: "SAIDA", quantidade: 1 }),
    ).rejects.toThrow(/saldo/i);
  });
  it("incorpora downloads sem ecoar para a outbox e protege pendências ainda não enviadas", async () => {
    const local = await store.recordMovement(session, input);
    await store.applyRemote(
      "farm-1",
      [product],
      [{ ...local, quantidade: 999 }],
      [],
    );
    expect((await store.snapshot("farm-1")).movements[0]?.quantidade).toBe(100);
    expect(await store.pending("farm-1")).toHaveLength(1);
    await store.applyRemote("farm-1", [product], [local], [local.id]);
    expect(await store.pending("farm-1")).toEqual([]);
    expect((await store.snapshot("farm-1")).movements).toHaveLength(1);
  });
  it("aplica retorno em transação e não confirma fila se um registro remoto é inválido", async () => {
    const local = await store.recordMovement(session, input);
    await expect(
      store.applyRemote(
        "farm-1",
        [product],
        [{ ...local, farmId: "outra" }],
        [local.id],
      ),
    ).rejects.toThrow();
    expect(await store.pending("farm-1")).toHaveLength(1);
  });
  it("isola dados e pendências por fazenda e mantém listas vazias válidas", async () => {
    await store.recordMovement(session, input);
    expect(await store.snapshot("outra")).toEqual({
      products: [],
      movements: [],
    });
    expect(await store.pending("outra")).toEqual([]);
  });
  it("serializa duas baixas concorrentes para não ultrapassar o saldo local", async () => {
    await store.recordMovement(session, { ...input, quantidade: 10 });
    const result = await Promise.allSettled([
      store.recordMovement(session, { ...input, tipo: "SAIDA", quantidade: 8 }),
      store.recordMovement(session, { ...input, tipo: "SAIDA", quantidade: 8 }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("rejeita data impossível e movimentação futura", async () => {
    await expect(
      store.recordMovement(session, {
        ...input,
        dataMovimento: "2026-02-31T12:00:00Z",
      }),
    ).rejects.toThrow();
    await expect(
      store.recordMovement(session, {
        ...input,
        dataMovimento: "2999-01-01T00:00:00Z",
      }),
    ).rejects.toThrow();
  });
  it("não persiste senha ou campos desconhecidos na sessão", async () => {
    await store.saveSession({ ...session, senha: "não persistir" } as never);
    expect(await store.loadSession()).not.toHaveProperty("senha");
  });
  it("mantém a sessão e confirmações separadas ao sair", async () => {
    await store.saveSession(session);
    await store.recordMovement(session, input);
    await store.clearSession();
    expect(await store.loadSession()).toBeNull();
    expect(await store.pending("farm-1")).toHaveLength(1);
  });
});
