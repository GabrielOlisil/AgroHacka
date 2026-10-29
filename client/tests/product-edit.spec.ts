import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { LocalStore } from "../src/offline/local-store";
import type { SqlDatabase, Statement } from "../src/offline/database";
import { parseProduct, type Product, type Session } from "../src/offline/types";
import { createWorkspace } from "../src/workspace";

const manager: Session = {
  role: "GESTOR",
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Ana",
  accessToken: "signed",
};
const id = "12345678-1234-4234-9234-123456789abc";
const product: Product = {
  id,
  farmId: "f",
  nome: "Uréia Fertilizante 46",
  categoria: "Fertilizantes",
  unidadeMedida: "kg",
  estoqueMinimo: 10,
  precoAquisicao: null,
  validade: null,
};
const response = (over: object = {}) => ({
  ...product,
  lote: null,
  fornecedor: null,
  ativo: true,
  excluidoEm: null,
  createdAt: "2026-10-29T12:00:00.000Z",
  updatedAt: "2026-10-29T12:00:00.000Z",
  ...over,
});

describe("API: editar e excluir insumo", () => {
  it("edita com PATCH autenticado e devolve o produto da fazenda", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe(`/products/${id}`);
      expect(req.method).toBe("PATCH");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      expect(await req.json()).toEqual({ nome: "Ureia", ativo: false });
      return Response.json(response({ nome: "Ureia", ativo: false }));
    });
    const api = createApi("http://api.test", fetcher);
    expect(
      await api.updateProduct(manager, id, { nome: "Ureia", ativo: false }),
    ).toMatchObject({ id, nome: "Ureia", ativo: false });
  });

  it("exclui com DELETE e devolve a marca de exclusão", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe(`/products/${id}`);
      expect(req.method).toBe("DELETE");
      return Response.json(
        response({ excluidoEm: "2026-10-29T18:00:00.000Z" }),
      );
    });
    const api = createApi("http://api.test", fetcher);
    expect(await api.deleteProduct(manager, id)).toMatchObject({
      excluidoEm: "2026-10-29T18:00:00.000Z",
    });
  });

  it.each([
    ["outro insumo", response({ id: "22345678-1234-4234-9234-123456789abc" })],
    ["outra fazenda", response({ farmId: "g" })],
    ["resposta vazia", null],
  ])("recusa resposta de %s", async (_name, body) => {
    const api = createApi("http://api.test", async () => Response.json(body));
    await expect(api.updateProduct(manager, id, { nome: "X" })).rejects.toThrow();
    await expect(api.deleteProduct(manager, id)).rejects.toThrow();
  });

  it("operador não edita nem exclui", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = createApi("http://api.test", fetcher);
    const operator = { ...manager, role: "OPERADOR" as const };
    await expect(api.updateProduct(operator, id, { nome: "X" })).rejects.toThrow(
      /gestor/,
    );
    await expect(api.deleteProduct(operator, id)).rejects.toThrow(/gestor/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("lê ativo e excluidoEm do produto, sem exigir os campos de versões antigas", () => {
    expect(parseProduct(response({ ativo: false }))).toMatchObject({
      ativo: false,
    });
    expect(
      parseProduct(response({ excluidoEm: "2026-10-29T18:00:00.000Z" })),
    ).toMatchObject({ excluidoEm: "2026-10-29T18:00:00.000Z" });
    expect(parseProduct(product)).not.toHaveProperty("ativo");
    expect(() => parseProduct(response({ ativo: "não" }))).toThrow();
  });
});

function sqliteStore() {
  const db = new DatabaseSync(":memory:");
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
const excluded = { ...product, excluidoEm: "2026-10-29T18:00:00.000Z" };
const syncResponse = (newProducts: Product[]) => ({
  protocolVersion: 2,
  sucesso: true,
  serverTimestamp: "2026-10-29T18:05:00.000Z",
  syncedCount: 0,
  results: [],
  newMovements: [],
  newProducts,
  divergences: [],
});

describe("SQLite local: insumo excluído", () => {
  it("apaga a cópia local quando o gestor exclui", async () => {
    const store = sqliteStore();
    await store.applyRemote("f", [product], [], []);
    await store.upsertProducts("f", [excluded]);
    expect((await store.snapshot("f")).products).toEqual([]);
  });

  it("o sync leva a exclusão ao celular", async () => {
    const store = sqliteStore();
    await store.applyRemote("f", [product], [], []);
    await store.applySyncResponse("f", syncResponse([excluded]) as never, []);
    expect((await store.snapshot("f")).products).toEqual([]);
  });

  it("guarda a marca, sem quebrar o sync, se ainda houver movimentação local do insumo", async () => {
    const store = sqliteStore();
    await store.applyRemote("f", [product], [], []);
    await store.recordMovement(
      { ...manager, role: "OPERADOR", deviceId: "d" },
      {
        productId: id,
        tipo: "ENTRADA",
        quantidade: 1,
        dataMovimento: "2026-10-29T12:00:00Z",
        destino: "",
      },
    );
    await store.applySyncResponse("f", syncResponse([excluded]) as never, []);
    expect((await store.snapshot("f")).products).toEqual([
      expect.objectContaining({ id, excluidoEm: excluded.excluidoEm }),
    ]);
  });

  it("guarda o insumo desativado para poder reativar", async () => {
    const store = sqliteStore();
    await store.applyRemote("f", [{ ...product, ativo: false }], [], []);
    expect((await store.snapshot("f")).products).toEqual([
      expect.objectContaining({ id, ativo: false }),
    ]);
  });
});

function setup(products: Product[] = [product]) {
  const store = {
    loadSession: vi.fn().mockResolvedValue(manager),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    snapshot: vi.fn().mockResolvedValue({ products, movements: [] }),
    pending: vi.fn().mockResolvedValue([]),
    lastSync: vi.fn().mockResolvedValue(null),
    syncReviews: vi.fn().mockResolvedValue([]),
    saveAlerts: vi.fn(),
    upsertProducts: vi.fn(async (_farm: string, changed: Product[]) => {
      store.snapshot.mockResolvedValue({ products: changed, movements: [] });
    }),
  };
  const api = {
    updateProduct: vi.fn(async (_s: Session, _id: string, patch: object) =>
      parseProduct(response(patch)),
    ),
    deleteProduct: vi.fn(async () =>
      parseProduct(response({ excluidoEm: "2026-10-29T18:00:00.000Z" })),
    ),
    sync: vi.fn(),
  };
  const workspace = createWorkspace({
    openStore: async () => store as never,
    api: api as never,
    backups: { create: vi.fn(), list: vi.fn().mockResolvedValue([]), restore: vi.fn() },
  });
  return { workspace, store, api };
}

describe("workspace: editar, desativar e excluir insumo", () => {
  it("desativados e excluídos saem da análise; desativados ficam numa lista própria", async () => {
    const { workspace } = setup([
      product,
      { ...product, id: "inativo", nome: "Inativo", ativo: false },
      { ...product, id: "apagado", nome: "Apagado", excluidoEm: excluded.excluidoEm },
    ]);
    await workspace.initialize();
    expect(workspace.analysis.value.products.map((p) => p.id)).toEqual([id]);
    expect(workspace.inactiveProducts.value.map((p) => p.id)).toEqual([
      "inativo",
    ]);
  });

  it("edita pela API, grava no SQLite e atualiza a tela", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    await workspace.updateProduct(id, { nome: "Ureia", ativo: false });
    expect(api.updateProduct).toHaveBeenCalledWith(manager, id, {
      nome: "Ureia",
      ativo: false,
    });
    expect(store.upsertProducts).toHaveBeenCalledWith(
      "f",
      [expect.objectContaining({ nome: "Ureia", ativo: false })],
      expect.any(Function),
    );
    expect(workspace.analysis.value.products).toEqual([]);
    expect(workspace.inactiveProducts.value.map((p) => p.nome)).toEqual([
      "Ureia",
    ]);
  });

  it("exclui pela API e grava a marca de exclusão", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    await workspace.deleteProduct(id);
    expect(api.deleteProduct).toHaveBeenCalledWith(manager, id);
    expect(store.upsertProducts).toHaveBeenCalledWith(
      "f",
      [expect.objectContaining({ excluidoEm: excluded.excluidoEm })],
      expect.any(Function),
    );
    expect(workspace.analysis.value.products).toEqual([]);
  });

  it("não grava nada se a API recusar", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    api.deleteProduct.mockRejectedValueOnce(new Error("tem movimentações"));
    await expect(workspace.deleteProduct(id)).rejects.toThrow(
      "tem movimentações",
    );
    expect(store.upsertProducts).not.toHaveBeenCalled();
  });
});
