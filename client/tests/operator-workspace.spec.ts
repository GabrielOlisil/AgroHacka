import { describe, expect, it, vi } from "vitest";
import { createWorkspace } from "../src/workspace";
const session = {
  farmId: "f",
  farmNome: "Fazenda",
  role: "GESTOR" as const,
  nome: "Gestor",
  accessToken: "signed",
};
const paired = {
  id: "d",
  farmId: "f",
  nomeOperador: "Ana",
  ativo: true,
  pairingCode: "AGRO-TEST",
  createdAt: "2026-10-27T12:00:00Z",
};
function setup(role: "GESTOR" | "OPERADOR" = "GESTOR") {
  const store = {
    loadSession: vi.fn().mockResolvedValue({ ...session, role }),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    snapshot: vi.fn().mockResolvedValue({ products: [], movements: [] }),
    pending: vi.fn().mockResolvedValue([]),
    syncReviews: vi.fn().mockResolvedValue([]),
    lastSync: vi.fn().mockResolvedValue(null),
    saveAlerts: vi.fn(),
  };
  const api = {
    listOperators: vi.fn().mockResolvedValue([paired]),
    updateOperator: vi.fn().mockResolvedValue(undefined),
    deleteOperator: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn(),
  };
  const backups = {
    create: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    restore: vi.fn(),
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
describe("operator management workspace", () => {
  it("refreshes canonical operators after an acknowledged change and preserves movement state", async () => {
    const { workspace, api, store } = setup();
    await workspace.initialize();
    await workspace.loadOperators();
    api.listOperators.mockResolvedValueOnce([
      { ...paired, nomeOperador: "Maria" },
    ]);
    await workspace.updateOperator("d", { nomeOperador: "Maria" });
    expect(api.updateOperator).toHaveBeenCalledWith(
      expect.objectContaining(session),
      "d",
      { nomeOperador: "Maria" },
    );
    expect(workspace.operators.value[0]?.nomeOperador).toBe("Maria");
    api.listOperators.mockResolvedValueOnce([]);
    await workspace.deleteOperator("d");
    expect(workspace.operators.value).toEqual([]);
    expect(api.deleteOperator).toHaveBeenCalledWith(
      expect.objectContaining(session),
      "d",
    );
    expect(api.sync).not.toHaveBeenCalled();
    expect(store.clearSession).not.toHaveBeenCalled();
  });
  it("refuses administrative calls from operators", async () => {
    const { workspace, api } = setup("OPERADOR");
    await workspace.initialize();
    await expect(
      workspace.updateOperator("d", { ativo: false }),
    ).rejects.toThrow(/gestor/i);
    await expect(workspace.deleteOperator("d")).rejects.toThrow(/gestor/i);
    expect(api.updateOperator).not.toHaveBeenCalled();
    expect(api.deleteOperator).not.toHaveBeenCalled();
  });
  it("keeps the list on network failure without removing a device optimistically", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    await workspace.loadOperators();
    api.deleteOperator.mockRejectedValueOnce(new TypeError("offline"));
    await expect(workspace.deleteOperator("d")).rejects.toThrow("offline");
    expect(workspace.operators.value).toEqual([paired]);
  });
  it.each(["logout", "restore", "dispose"] as const)(
    "discards late mutation response after %s",
    async (action) => {
      const { workspace, api } = setup();
      await workspace.initialize();
      await workspace.loadOperators();
      let finish!: () => void;
      api.deleteOperator.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const outcome = workspace.deleteOperator("d").catch((cause) => cause);
      if (action === "logout") await workspace.logout();
      if (action === "restore") await workspace.restoreBackup("backup.db");
      if (action === "dispose") workspace.dispose();
      finish();
      expect(await outcome).toBeInstanceOf(Error);
      expect(api.listOperators).toHaveBeenCalledOnce();
      expect(workspace.operators.value).toEqual([]);
    },
  );
  it("does not allow simultaneous mutations and ignores a stale pre-mutation listing", async () => {
    const { workspace, api } = setup();
    await workspace.initialize();
    let finishLookup!: (value: (typeof paired)[]) => void;
    api.listOperators.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLookup = resolve;
      }),
    );
    const lookup = workspace.loadOperators();
    let finishDelete!: () => void;
    api.deleteOperator.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDelete = resolve;
      }),
    );
    const deletion = workspace.deleteOperator("d");
    await expect(workspace.deleteOperator("d")).rejects.toThrow(/aguarde/i);
    api.listOperators.mockResolvedValueOnce([]);
    finishDelete();
    await deletion;
    finishLookup([paired]);
    await lookup;
    expect(workspace.operators.value).toEqual([]);
    expect(api.deleteOperator).toHaveBeenCalledOnce();
  });
});
