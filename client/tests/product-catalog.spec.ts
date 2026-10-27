import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "../src/offline/local-store";
import { createApi } from "../src/api/client";
import type { SqlDatabase, Statement } from "../src/offline/database";
import {
  parseProduct,
  parseProductInput,
  type Product,
  type ProductInput,
} from "../src/offline/types";

export const input: ProductInput = {
  id: "12345678-1234-4234-9234-123456789abc",
  nome: "Óleo",
  categoria: "Manutenção / 自然 🌱",
  unidadeMedida: "L",
  estoqueMinimo: 0,
  precoAquisicao: null,
  validade: null,
};
const manager = {
  role: "GESTOR" as const,
  farmId: "farm-a",
  farmNome: "Fazenda",
  nome: "Ana",
  accessToken: "signed",
};
export const product: Product = {
  ...input,
  farmId: manager.farmId,
  updatedAt: "2026-10-27T12:00:00.000Z",
};

describe("validação de cadastro de produto", () => {
  it("lê datas canônicas de todo ano aceito na entrada e conserva createdAt", () => {
    const canonical = {
      ...product,
      validade: "0001-01-01T00:00:00.000Z",
      createdAt: "2026-10-27T12:00:00.000Z",
    };
    expect(parseProduct(canonical, manager.farmId)).toEqual(canonical);
  });
  it("acompanha aliases e anos válidos do backend sem aceitar UUID com espaços", () => {
    expect(
      parseProductInput({
        ...input,
        unidadeMedida: "sacos",
        validade: "0001-01-01",
      }),
    ).toMatchObject({ unidadeMedida: "sc", validade: "0001-01-01" });
    expect(() =>
      parseProductInput({ ...input, id: ` ${input.id} ` }),
    ).toThrow();
  });
  it("normaliza texto NFC, UUID e opcionais preservando preço zero", () => {
    expect(
      parseProductInput({
        ...input,
        id: input.id.toUpperCase(),
        nome: " O\u0301leo ",
        categoria: " Livre 🌱 ",
        unidadeMedida: " litros ",
        precoAquisicao: 0,
        validade: "2028-02-29",
        lote: " A ",
        fornecedor: " José ",
      }),
    ).toEqual({
      ...input,
      categoria: "Livre 🌱",
      precoAquisicao: 0,
      validade: "2028-02-29",
      lote: "A",
      fornecedor: "José",
    });
    expect(parseProductInput(input).precoAquisicao).toBeNull();
  });
  it.each([
    ["lt", "L"],
    ["KG", "kg"],
    ["unidades", "un"],
    ["saca", "sc"],
    ["tonelada", "t"],
    ["metros", "m"],
    ["m²", "m²"],
    ["m³", "m³"],
    [" Caixa especial ", "Caixa especial"],
  ])("normaliza %s para %s sem conversão numérica", (raw, expected) => {
    expect(
      parseProductInput({ ...input, unidadeMedida: raw, estoqueMinimo: 1.25 }),
    ).toMatchObject({ unidadeMedida: expected, estoqueMinimo: 1.25 });
  });
  const invalid = [
    null,
    undefined,
    [],
    {},
    ...["id", "nome", "categoria", "unidadeMedida", "estoqueMinimo"].flatMap(
      (field) =>
        [undefined, null, "", " ", [], {}].map((value) => ({
          ...input,
          [field]: value,
        })),
    ),
    ...["estoqueMinimo", "precoAquisicao"].flatMap((field) =>
      [-1, NaN, Infinity, "2", true].map((value) => ({
        ...input,
        [field]: value,
      })),
    ),
    ...[
      "",
      "2026-02-29",
      "2026-02-30",
      "0000-01-01",
      "2026-10-27T12:00:00Z",
      1,
    ].map((validade) => ({ ...input, validade })),
    ...["lote", "fornecedor"].flatMap((field) =>
      ["", " ", 1, true, {}, []].map((value) => ({ ...input, [field]: value })),
    ),
    { ...input, id: "not-uuid" },
    { ...input, farmId: "forged" },
    { ...input, saldoInicial: 10 },
  ];
  it.each(invalid.map((value, i) => [i, value]))(
    "rejeita entrada inválida %i",
    (_i, value) => {
      expect(() => parseProductInput(value)).toThrow();
    },
  );
});

describe("POST /products com openapi-fetch", () => {
  it("envia JWT e payload normalizado sem fazenda, saldo ou credencial de operador", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(req.method).toBe("POST");
      expect(new URL(req.url).pathname).toBe("/products");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      expect(req.headers.has("x-device-token")).toBe(false);
      expect(await req.json()).toEqual({ ...input, precoAquisicao: 0 });
      return Response.json(product, { status: 201 });
    });
    expect(
      await createApi("http://api.test", fetcher).createProduct(
        { ...input, unidadeMedida: "litros", precoAquisicao: 0 },
        { ...manager, deviceToken: "not-for-this-endpoint" },
      ),
    ).toEqual(product);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("nega operador ou token ausente antes de enviar", async () => {
    const fetcher = vi.fn();
    const api = createApi("http://api.test", fetcher);
    await expect(
      api.createProduct(input, { ...manager, role: "OPERADOR" }),
    ).rejects.toThrow(/gestor/i);
    await expect(
      api.createProduct(input, { ...manager, accessToken: undefined }),
    ).rejects.toThrow(/token/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    null,
    undefined,
    {},
    { ...input, farmId: "foreign" },
    { ...input, precoAquisicao: "" },
    { ...input, validade: "2026-02-30" },
    { ...input, estoqueMinimo: -1 },
  ])("valida input em runtime antes da rede", async (value) => {
    const fetcher = vi.fn();
    await expect(
      createApi("http://api.test", fetcher).createProduct(
        value as never,
        manager,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 409, 500])(
    "preserva erro HTTP %i e mensagem",
    async (status) => {
      await expect(
        createApi("http://api.test", async () =>
          Response.json({ message: "Cadastro recusado" }, { status }),
        ).createProduct(input, manager),
      ).rejects.toMatchObject({ status, message: "Cadastro recusado" });
    },
  );
  it.each([
    null,
    {},
    { ...product, farmId: "foreign" },
    { ...product, id: "other" },
    { ...product, estoqueMinimo: -1 },
  ])("recusa resposta inválida ou de outra fazenda/UUID", async (value) => {
    await expect(
      createApi("http://api.test", async () =>
        Response.json(value, { status: 201 }),
      ).createProduct(input, manager),
    ).rejects.toThrow();
  });
  it("mantém UUID e corpo no retry de resposta perdida e não esconde falha de rede", async () => {
    const requests: unknown[] = [];
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      requests.push(await (request as Request).json());
      if (requests.length === 1) throw new TypeError("network lost");
      return Response.json(product, { status: 201 });
    });
    const api = createApi("http://api.test", fetcher);
    await expect(api.createProduct(input, manager)).rejects.toThrow(
      "network lost",
    );
    expect(await api.createProduct(input, manager)).toEqual(product);
    expect(requests).toEqual([input, input]);
  });
  it.each([false, true])(
    "aplica timeout à requisição com sinal já abortado=%s",
    async (alreadyAborted) => {
      const controller = new AbortController();
      const timeout = vi
        .spyOn(AbortSignal, "timeout")
        .mockReturnValue(controller.signal);
      const reason = new DOMException("Tempo esgotado", "TimeoutError");
      if (alreadyAborted) controller.abort(reason);
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const api = createApi(
        "http://api.test",
        async (request) => {
          const signal = (request as Request).signal;
          entered();
          signal.throwIfAborted();
          await new Promise<void>((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            }),
          );
          return Response.json(product);
        },
        10,
      );
      try {
        const result = expect(
          api.createProduct(input, manager),
        ).rejects.toMatchObject({ name: "TimeoutError" });
        await started;
        if (!alreadyAborted) controller.abort(reason);
        await result;
        expect(timeout).toHaveBeenCalledWith(10);
      } finally {
        timeout.mockRestore();
      }
    },
  );
});

describe("catálogo canônico em SQLite real temporário", () => {
  let db: DatabaseSync;
  let store: LocalStore;
  let adapter: SqlDatabase;
  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(
      readFileSync(
        new URL("../src-tauri/migrations/001_offline.sql", import.meta.url),
        "utf8",
      ),
    );
    adapter = {
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
        } catch (cause) {
          db.exec("ROLLBACK");
          throw cause;
        }
      },
    };
    store = new LocalStore(adapter);
  });
  afterEach(() => db.close());
  it("atualiza por fazenda/id sem duplicar, inventar saldo ou remover histórico/outbox", async () => {
    await store.upsertProducts(manager.farmId, [product]);
    const movement = await store.recordMovement(manager, {
      id: "pending",
      productId: product.id,
      tipo: "ENTRADA",
      quantidade: 2,
      dataMovimento: "2026-10-01",
    });
    await store.setLastSync(manager.farmId, "2026-10-01");
    const updated = { ...product, nome: "Canônico", precoAquisicao: 0 };
    await store.upsertProducts(manager.farmId, [updated]);
    await store.upsertProducts("farm-b", [{ ...product, farmId: "farm-b" }]);
    expect(await new LocalStore(adapter).snapshot(manager.farmId)).toEqual({
      products: [updated],
      movements: [movement],
    });
    expect(await store.pending(manager.farmId)).toEqual([movement]);
    expect(await store.lastSync(manager.farmId)).toBe(
      "2026-10-01T00:00:00.000Z",
    );
    expect((await store.snapshot("farm-b")).products).toHaveLength(1);
  });
  it("aceita catálogo vazio e rejeita todo lote inválido ou de outra fazenda", async () => {
    await store.upsertProducts(manager.farmId, []);
    for (const bad of [
      null,
      undefined,
      {},
      [product, { ...product, id: "second", farmId: "foreign" }],
      [product, { ...product, id: "second", estoqueMinimo: -1 }],
    ]) {
      await expect(
        store.upsertProducts(manager.farmId, bad as never),
      ).rejects.toThrow();
      expect((await store.snapshot(manager.farmId)).products).toEqual([]);
    }
  });
  it("reverte lote inteiro em falha SQLite e permite tentar novamente", async () => {
    db.exec(
      "CREATE TRIGGER fail_product BEFORE INSERT ON products WHEN NEW.id='fail' BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
    );
    await expect(
      store.upsertProducts(manager.farmId, [
        product,
        { ...product, id: "fail" },
      ]),
    ).rejects.toThrow("injected failure");
    expect((await store.snapshot(manager.farmId)).products).toEqual([]);
    await store.upsertProducts(manager.farmId, [product]);
    expect((await store.snapshot(manager.farmId)).products).toEqual([product]);
  });
  it("serializa com outras escritas e revalida sessão quando sai da fila", async () => {
    let release!: () => void;
    const original = adapter.transaction.bind(adapter);
    vi.spyOn(adapter, "transaction").mockImplementationOnce(
      async (statements) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await original(statements);
      },
    );
    const first = store.upsertProducts(manager.farmId, [product]);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    let active = true;
    const late = store.upsertProducts(
      manager.farmId,
      [{ ...product, nome: "Late" }],
      () => active,
    );
    const outcome = late.catch((cause) => cause);
    active = false;
    release();
    await first;
    expect(await outcome).toBeInstanceOf(Error);
    expect((await store.snapshot(manager.farmId)).products).toEqual([product]);
    expect(adapter.transaction).toHaveBeenCalledOnce();
  });
});
