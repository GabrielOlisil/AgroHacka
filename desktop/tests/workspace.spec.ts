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
  };
  const api = {
    sync: vi.fn().mockRejectedValue(new Error("offline")),
    login: vi.fn().mockResolvedValue(session),
    register: vi.fn().mockResolvedValue(session),
    connect: vi.fn().mockResolvedValue(session),
    pairing: vi.fn(),
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
    expect(store.recordMovement).toHaveBeenCalledWith(session, input);
    expect(store.snapshot.mock.calls.length).toBeGreaterThan(1);
  });
  it("operador não pode gerar códigos para outros operadores", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    await expect(workspace.pair("Outro")).rejects.toThrow(/gestor/i);
    expect(api.pairing).not.toHaveBeenCalled();
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
