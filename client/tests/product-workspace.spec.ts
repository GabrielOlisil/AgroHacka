import { describe, expect, it, vi } from "vitest";
import { createWorkspace } from "../src/workspace";
import type { Product, ProductInput, Session } from "../src/offline/types";

const manager: Session = {
  role: "GESTOR",
  farmId: "farm-a",
  farmNome: "Fazenda",
  nome: "Ana",
  accessToken: "signed",
};
const input: ProductInput = {
  id: "12345678-1234-4234-9234-123456789abc",
  nome: "Óleo",
  categoria: "Livre 🌱",
  unidadeMedida: "L",
  estoqueMinimo: 0,
  precoAquisicao: null,
  validade: null,
};
const product: Product = {
  ...input,
  farmId: manager.farmId,
  nome: "Óleo canônico",
  updatedAt: "2026-10-27T12:00:00.000Z",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}
function setup(session: Session | null = manager) {
  const store = {
    loadSession: vi.fn().mockResolvedValue(session),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    snapshot: vi.fn().mockResolvedValue({ products: [], movements: [] }),
    pending: vi.fn().mockResolvedValue([]),
    lastSync: vi.fn().mockResolvedValue(null),
    syncReviews: vi.fn().mockResolvedValue([]),
    saveAlerts: vi.fn(),
    upsertProducts: vi
      .fn()
      .mockImplementation(async (_farm, products, active) => {
        if (active && !active()) throw new Error("Sessão alterada");
        store.snapshot.mockResolvedValue({ products, movements: [] });
      }),
  };
  const api = {
    createProduct: vi.fn().mockResolvedValue(product),
    sync: vi.fn(),
    login: vi.fn().mockResolvedValue(manager),
  };
  const backups = {
    create: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    restore: vi.fn(),
  };
  const workspace = createWorkspace({
    openStore: async () => store as never,
    api: api as never,
    backups,
  });
  return { workspace, store, api, backups };
}
describe("cadastro online do gestor no workspace", () => {
  it("aceita replay com opcionais nulos equivalentes a ausentes", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    api.createProduct.mockRejectedValueOnce(new Error("timeout"));
    await expect(workspace.createProduct(input)).rejects.toThrow("timeout");
    await expect(
      workspace.createProduct({ ...input, lote: null, fornecedor: null }),
    ).resolves.toEqual(product);
  });
  it("uma nova sessão não reutiliza promessa pendente da sessão anterior", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    const response = deferred<Product>();
    api.createProduct.mockReturnValueOnce(response.promise);
    const old = workspace.createProduct(input).catch((cause) => cause);
    await workspace.logout();
    await workspace.login({ email: "a@b.test", senha: "secret" });
    const retry = workspace.createProduct(input);
    expect(api.createProduct).toHaveBeenCalledTimes(2);
    response.resolve(product);
    expect(await old).toBeInstanceOf(Error);
    expect(await retry).toEqual(product);
    expect(store.upsertProducts).toHaveBeenCalledOnce();
  });
  it.each(["logout", "restore"] as const)(
    "%s aguarda a escrita SQLite iniciada antes de concluir",
    async (action) => {
      const { workspace, store, backups, api } = setup();
      await workspace.initialize();
      const gate = deferred<void>();
      store.upsertProducts.mockImplementationOnce(async () => {
        await gate.promise;
      });
      const outcome = workspace.createProduct(input).catch((cause) => cause);
      await vi.waitFor(() =>
        expect(store.upsertProducts).toHaveBeenCalledOnce(),
      );
      const transition =
        action === "logout"
          ? workspace.logout()
          : workspace.restoreBackup("backup.db");
      await expect(
        workspace.createProduct({
          ...input,
          id: "22345678-1234-4234-9234-123456789abc",
        }),
      ).rejects.toThrow(/sessão|restaura/i);
      expect(api.createProduct).toHaveBeenCalledOnce();
      if (action === "logout")
        expect(store.clearSession).not.toHaveBeenCalled();
      else expect(backups.restore).not.toHaveBeenCalled();
      gate.resolve();
      await transition;
      expect(await outcome).toBeInstanceOf(Error);
    },
  );
  it("não atualiza catálogo nem alertas se logout ocorrer durante o refresh pós-cadastro", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    const gate = deferred<{ products: Product[]; movements: never[] }>();
    store.upsertProducts.mockResolvedValueOnce(undefined);
    store.snapshot.mockReturnValueOnce(gate.promise);
    const outcome = workspace.createProduct(input).catch((cause) => cause);
    await vi.waitFor(() => expect(store.snapshot).toHaveBeenCalledTimes(2));
    await workspace.logout();
    gate.resolve({ products: [product], movements: [] });
    expect(await outcome).toBeInstanceOf(Error);
    expect(workspace.analysis.value.products).toEqual([]);
    expect(store.saveAlerts).toHaveBeenCalledOnce();
  });
  it("retorna e persiste somente o canônico e recalcula catálogo com saldo zero", async () => {
    const { workspace, store, api } = setup();
    await workspace.initialize();
    expect(await workspace.createProduct(input)).toEqual(product);
    expect(api.createProduct).toHaveBeenCalledWith(input, manager);
    expect(store.upsertProducts).toHaveBeenCalledWith(
      manager.farmId,
      [product],
      expect.any(Function),
    );
    expect(workspace.analysis.value.products[0]).toMatchObject({
      nome: product.nome,
      saldo: 0,
    });
    expect(workspace.pendingCount.value).toBe(0);
  });
  it.each([
    null,
    { ...manager, role: "OPERADOR" as const },
    { ...manager, accessToken: undefined },
  ])("nega sessão sem gestor autenticado", async (session) => {
    const { workspace, api, store } = setup(session);
    await workspace.initialize();
    await expect(workspace.createProduct(input)).rejects.toThrow(
      /gestor|token/i,
    );
    expect(api.createProduct).not.toHaveBeenCalled();
    expect(store.upsertProducts).not.toHaveBeenCalled();
  });
  it("mantém UUID/payload após falha online sem fantasma e rejeita conteúdo alterado no retry", async () => {
    const { workspace, store, api } = setup();
    await workspace.initialize();
    api.createProduct.mockRejectedValueOnce(new Error("offline"));
    await expect(workspace.createProduct(input)).rejects.toThrow("offline");
    expect(store.upsertProducts).not.toHaveBeenCalled();
    expect(workspace.analysis.value.products).toEqual([]);
    await expect(
      workspace.createProduct({ ...input, nome: "Alterado" }),
    ).rejects.toThrow(/conteúdo|identificador/i);
    await workspace.createProduct({ ...input });
    expect(api.createProduct.mock.calls.map(([body]) => body)).toEqual([
      input,
      input,
    ]);
  });
  it("captura cópia do payload antes da rede e une cliques simultâneos", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    const response = deferred<Product>();
    api.createProduct.mockReturnValueOnce(response.promise);
    const draft = { ...input };
    const first = workspace.createProduct(draft);
    const second = workspace.createProduct({ ...input });
    draft.nome = "Mudou enquanto enviava";
    expect(api.createProduct).toHaveBeenCalledOnce();
    expect(api.createProduct.mock.calls[0]![0].nome).toBe(input.nome);
    response.resolve(product);
    expect(await first).toEqual(product);
    expect(await second).toEqual(product);
  });
  it.each([
    null,
    { ...product, farmId: "foreign" },
    { ...product, id: "other" },
    { ...product, estoqueMinimo: -1 },
  ])("recusa resposta inválida sem persistir", async (result) => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    api.createProduct.mockResolvedValueOnce(result as never);
    await expect(workspace.createProduct(input)).rejects.toThrow();
    expect(store.upsertProducts).not.toHaveBeenCalled();
  });
  it.each(["logout", "session", "restore", "dispose"] as const)(
    "descarta resposta tardia após %s",
    async (action) => {
      const { workspace, api, store } = setup();
      await workspace.initialize();
      const response = deferred<Product>();
      api.createProduct.mockReturnValueOnce(response.promise);
      const outcome = workspace.createProduct(input).catch((cause) => cause);
      if (action === "logout") await workspace.logout();
      if (action === "session")
        await workspace.login({ email: "another@test.local", senha: "secret" });
      if (action === "restore") await workspace.restoreBackup("backup.db");
      if (action === "dispose") workspace.dispose();
      response.resolve(product);
      expect(await outcome).toBeInstanceOf(Error);
      expect(store.upsertProducts).not.toHaveBeenCalled();
      expect(workspace.analysis.value.products).toEqual([]);
    },
  );
  it("revalida operação invalidada enquanto escrita aguarda fila SQLite", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    const gate = deferred<void>();
    let guard!: () => boolean;
    store.upsertProducts.mockImplementationOnce(
      async (_farm, _products, active) => {
        guard = active;
        await gate.promise;
        if (!active()) throw new Error("Sessão alterada");
      },
    );
    const outcome = workspace.createProduct(input).catch((cause) => cause);
    await vi.waitFor(() => expect(guard).toBeTypeOf("function"));
    workspace.dispose();
    expect(guard()).toBe(false);
    gate.resolve();
    expect(await outcome).toBeInstanceOf(Error);
  });
  it("bloqueia novas criações durante restauração e depois de dispose", async () => {
    const { workspace, backups, api } = setup();
    await workspace.initialize();
    const gate = deferred<void>();
    backups.restore.mockReturnValueOnce(gate.promise);
    const restoring = workspace.restoreBackup("backup.db");
    await expect(workspace.createProduct(input)).rejects.toThrow(/restaura/i);
    gate.resolve();
    await restoring;
    workspace.dispose();
    await expect(workspace.createProduct(input)).rejects.toThrow(
      /encerr|sessão/i,
    );
    expect(api.createProduct).not.toHaveBeenCalled();
  });
  it("não chama rede para input inválido", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    await expect(
      workspace.createProduct({ ...input, estoqueMinimo: -1 }),
    ).rejects.toThrow();
    expect(api.createProduct).not.toHaveBeenCalled();
  });
  it("permite retry após falha SQLite e resolve canônico se só o refresh falhar", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    store.upsertProducts.mockRejectedValueOnce(new Error("disk failed"));
    await expect(workspace.createProduct(input)).rejects.toThrow("disk failed");
    store.snapshot.mockRejectedValueOnce(new Error("read failed"));
    await expect(workspace.createProduct(input)).resolves.toEqual(product);
    expect(workspace.error.value).toMatch(/salv.*atualiz/i);
    expect(api.createProduct).toHaveBeenCalledTimes(2);
  });
});
