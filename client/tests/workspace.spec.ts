import { describe, expect, it, vi } from "vitest";
import { createWorkspace } from "../src/workspace";

const session = {
  role: "OPERADOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Ana",
  deviceId: "d",
};
function setup() {
  const store = {
    loadSession: vi.fn().mockResolvedValue(session),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    snapshot: vi.fn().mockResolvedValue({ products: [], movements: [] }),
    pending: vi.fn().mockResolvedValue([]),
    lastSync: vi.fn().mockResolvedValue(null),
    saveAlerts: vi.fn(),
    recordMovement: vi.fn(),
    draftId: vi.fn().mockResolvedValue("draft-id"),
    syncReviews: vi.fn().mockResolvedValue([]),
  };
  const api = {
    sync: vi.fn().mockRejectedValue(new Error("offline")),
    login: vi.fn().mockResolvedValue(session),
    register: vi.fn().mockResolvedValue(session),
    connect: vi.fn().mockResolvedValue(session),
    pairing: vi.fn(),
    listOperators: vi.fn().mockResolvedValue([]),
  };
  const backups = {
    create: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    restore: vi.fn().mockResolvedValue(undefined),
  };
  return {
    store,
    api,
    backups,
    workspace: createWorkspace({
      openStore: async () => store as never,
      api: api as never,
      backups,
    }),
  };
}
describe("fluxo do aplicativo offline", () => {
  it("loads paired operators only on request, using the current manager session", async () => {
    const { workspace, store, api } = setup();
    const manager = { ...session, role: "GESTOR" as const };
    store.loadSession.mockResolvedValue(manager as never);
    await workspace.initialize();
    expect(workspace.ready.value).toBe(true);
    expect(api.listOperators).not.toHaveBeenCalled();
    const paired = {
      id: "existing",
      farmId: "f",
      nomeOperador: "Ana",
      ativo: true,
      pairingCode: "AGRO-1234",
      createdAt: "2026-10-01T12:00:00Z",
    };
    api.listOperators.mockResolvedValueOnce([paired] as never);
    await workspace.loadOperators();
    expect(workspace.operators.value).toEqual([paired]);
    expect(api.listOperators).toHaveBeenCalledWith(manager);
    expect(api.pairing).not.toHaveBeenCalled();
    expect(store.saveSession).not.toHaveBeenCalled();
  });
  it("never requests pairing codes from an operator session", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    await expect(workspace.loadOperators()).rejects.toThrow(/gestor/i);
    expect(api.listOperators).not.toHaveBeenCalled();
  });
  it("can replace an older listing after a new pairing without letting its late response overwrite the new code", async () => {
    const { workspace, store, api } = setup();
    store.loadSession.mockResolvedValue({
      ...session,
      role: "GESTOR",
    } as never);
    await workspace.initialize();
    let finish!: (rows: never[]) => void;
    api.listOperators.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const earlier = workspace.loadOperators();
    const paired = {
      id: "new",
      farmId: "f",
      nomeOperador: "Ana",
      ativo: true,
      pairingCode: "AGRO-NEW",
      createdAt: "2026-10-01T12:00:00Z",
    };
    api.listOperators.mockResolvedValueOnce([paired] as never);
    await workspace.loadOperators(true);
    finish([]);
    await earlier;
    expect(workspace.operators.value).toEqual([paired]);
    expect(workspace.operatorsLoading.value).toBe(false);
  });
  it("keeps offline startup working and clears stale codes when a listing request fails", async () => {
    const { workspace, store, api } = setup();
    store.loadSession.mockResolvedValue({
      ...session,
      role: "GESTOR",
    } as never);
    await workspace.initialize();
    api.listOperators.mockRejectedValueOnce(new Error("offline"));
    await workspace.loadOperators();
    expect(workspace.operators.value).toEqual([]);
    expect(workspace.operatorsError.value).toMatch(/offline/i);
    expect(workspace.session.value).not.toBeNull();
    expect(workspace.operatorsLoading.value).toBe(false);
  });
  it("discards in-flight results on logout and never reveals the previous farm codes", async () => {
    const { workspace, store, api } = setup();
    store.loadSession.mockResolvedValue({
      ...session,
      role: "GESTOR",
    } as never);
    await workspace.initialize();
    let finish!: (result: unknown) => void;
    api.listOperators.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const listing = workspace.loadOperators();
    await Promise.resolve();
    expect(workspace.operatorsLoading.value).toBe(true);
    await workspace.logout();
    finish([{ id: "old", farmId: "f", pairingCode: "AGRO-OLD" }]);
    await listing;
    expect(workspace.operators.value).toEqual([]);
    expect(workspace.operatorsLoading.value).toBe(false);
  });
  it("faz manutenção periódica do backup apenas quando existe uma sessão", async () => {
    const { workspace, backups, store } = setup();
    store.loadSession.mockResolvedValue(null as never);
    await workspace.initialize();
    await workspace.maintainBackups();
    expect(backups.create).not.toHaveBeenCalled();
    await workspace.login({ email: "a@b.com", senha: "senha" });
    await workspace.maintainBackups();
    expect(backups.create).toHaveBeenCalledOnce();
  });
  it("abre sessão persistida sem chamar login e funciona com a API indisponível", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    expect(workspace.session.value).toEqual(session);
    expect(workspace.ready.value).toBe(true);
    expect(api.login).not.toHaveBeenCalled();
  });
  it("salva sessão recebida antes de tentar sincronizar", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    await workspace.login({ email: "ana@fazenda.com", senha: "senha" });
    expect(store.saveSession).toHaveBeenCalledWith(session);
    expect(workspace.session.value?.nome).toBe("Ana");
  });
  it("não remove pendências no logout", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    await workspace.logout();
    expect(store.clearSession).toHaveBeenCalledOnce();
    expect(workspace.session.value).toBeNull();
  });
  it("recalcula após registrar movimentação e mantém o responsável da sessão", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    const input = {
      productId: "p",
      tipo: "ENTRADA" as const,
      quantidade: 10,
      dataMovimento: "2026-10-16T12:00:00Z",
    };
    await workspace.record(input);
    expect(store.recordMovement).toHaveBeenCalledWith(session, {
      ...input,
      id: "draft-id",
    });
    expect(store.snapshot.mock.calls.length).toBeGreaterThan(1);
  });
  it("shows durable cloud reviews without deleting the session or retrying rejected attempts", async () => {
    const { workspace, store } = setup();
    store.syncReviews.mockResolvedValue([
      {
        id: "m",
        status: "VALIDATION_REJECTED",
        message: "Confira o produto",
        movement: { productId: "p" },
      },
    ]);
    await workspace.initialize();
    expect(workspace.reviews.value).toHaveLength(1);
    expect(workspace.session.value).toEqual(session);
  });
  it("operador não pode gerar códigos para outros operadores", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    await expect(workspace.pair("Outro")).rejects.toThrow(/gestor/i);
    expect(api.pairing).not.toHaveBeenCalled();
  });
  it("does not start a second save while the first draft is being persisted", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    let finish!: () => void;
    store.recordMovement.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const input = {
      productId: "p",
      tipo: "ENTRADA" as const,
      quantidade: 2,
      dataMovimento: "2026-10-01T12:00:00Z",
    };
    const saving = workspace.record(input);
    await vi.waitFor(() => expect(store.recordMovement).toHaveBeenCalledOnce());
    const repeated = workspace.record(input).catch((cause) => cause);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.recordMovement).toHaveBeenCalledOnce();
    finish();
    await saving;
    expect(await repeated).toEqual(
      expect.objectContaining({
        message: expect.stringMatching(/salvamento/i),
      }),
    );
    expect(store.draftId).toHaveBeenCalledOnce();
  });
  it("separates the known confirmed balance from pending local effects and clears it on logout", async () => {
    const { workspace, store } = setup();
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
    const entry = {
      id: "entry",
      farmId: "f",
      productId: "p",
      tipo: "ENTRADA",
      quantidade: 100,
      dataMovimento: "2026-10-01T12:00:00Z",
      responsavel: "Ana",
    };
    const pending = { ...entry, id: "pending", tipo: "SAIDA", quantidade: 70 };
    store.snapshot.mockResolvedValue({
      products: [product],
      movements: [entry, pending],
    } as never);
    store.pending.mockResolvedValue([pending] as never);
    await workspace.initialize();
    expect(workspace.analysis.value.products[0]?.saldo).toBe(30);
    expect(workspace.confirmedBalances.value.p).toBe(100);
    await workspace.logout();
    expect(workspace.confirmedBalances.value).toEqual({});
  });
  it("reports a post-commit refresh failure as saved, so the form can clear without repeating the operation", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    store.snapshot.mockRejectedValueOnce(new Error("read failed"));
    await expect(
      workspace.record({
        productId: "p",
        tipo: "ENTRADA",
        quantidade: 2,
        dataMovimento: "2026-10-01T12:00:00Z",
      }),
    ).resolves.toBeUndefined();
    expect(workspace.error.value).toMatch(/salv.*atualiz/i);
    expect(store.recordMovement).toHaveBeenCalledOnce();
  });
  it("reuses the captured draft ID after an uncertain native save response", async () => {
    const { workspace, store } = setup();
    await workspace.initialize();
    store.draftId
      .mockResolvedValueOnce("original-id")
      .mockResolvedValueOnce("new-id");
    store.recordMovement
      .mockRejectedValueOnce(new Error("native response lost"))
      .mockResolvedValueOnce(undefined);
    const input = {
      productId: "p",
      tipo: "ENTRADA" as const,
      quantidade: 2,
      dataMovimento: "2026-10-01T12:00:00Z",
    };
    await expect(workspace.record(input)).rejects.toThrow(
      "native response lost",
    );
    await workspace.record(input);
    expect(store.recordMovement.mock.calls.map(([, item]) => item.id)).toEqual([
      "original-id",
      "original-id",
    ]);
  });
  it("não inicia sincronização nem grava movimentações durante restauração", async () => {
    const { workspace, api, backups, store } = setup();
    await workspace.initialize();
    let finish!: () => void;
    backups.restore.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve(undefined);
      }),
    );
    const restoring = workspace.restoreBackup("backup-2026-10-16.db");
    await Promise.resolve();
    await workspace.sync();
    expect(api.sync).not.toHaveBeenCalled();
    await expect(
      workspace.record({
        productId: "p",
        tipo: "ENTRADA",
        quantidade: 1,
        dataMovimento: "2026-10-16",
      }),
    ).rejects.toThrow(/restaura/i);
    expect(store.recordMovement).not.toHaveBeenCalled();
    finish();
    await restoring;
  });
});
