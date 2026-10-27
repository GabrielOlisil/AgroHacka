// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { createWorkspace } from "../src/workspace";
import OperatorsPanel from "../src/components/OperatorsPanel.vue";

const manager = {
  role: "GESTOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Gestor",
  accessToken: "signed",
};
const paired = {
  id: "ana",
  farmId: "f",
  nomeOperador: "Ana",
  ativo: true,
  pairingCode: "AGRO-1234",
  createdAt: "2026-10-01T12:00:00.000Z",
};
const inactive = { ...paired, ativo: false, pairingCode: null };

describe("api.deactivateOperator", () => {
  it("envia POST autenticado para o aparelho e devolve a lista validada", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe("/devices/ana/deactivate");
      expect(req.method).toBe("POST");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      return Response.json({ farmId: "f", operators: [inactive] });
    });
    expect(
      await createApi("http://api.test", fetcher).deactivateOperator(manager, "ana"),
    ).toEqual([inactive]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("recusa sessão de operador, token ausente e identificador vazio sem chamar a API", async () => {
    const fetcher = vi.fn();
    const api = createApi("http://api.test", fetcher);
    await expect(
      api.deactivateOperator({ ...manager, role: "OPERADOR" }, "ana"),
    ).rejects.toThrow(/gestor/i);
    await expect(
      api.deactivateOperator({ ...manager, accessToken: undefined }, "ana"),
    ).rejects.toThrow(/token/i);
    await expect(api.deactivateOperator(manager, "  ")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("mantém o erro HTTP (404 de outra fazenda) e recusa resposta de outra fazenda", async () => {
    await expect(
      createApi("http://api.test", async () =>
        Response.json({ message: "Operador não encontrado" }, { status: 404 }),
      ).deactivateOperator(manager, "x"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createApi("http://api.test", async () =>
        Response.json({ farmId: "outra", operators: [] }),
      ).deactivateOperator(manager, "ana"),
    ).rejects.toThrow();
  });
});

function workspaceSetup(role: "GESTOR" | "OPERADOR" = "GESTOR") {
  const session = role === "GESTOR" ? manager : { ...manager, role, accessToken: undefined, deviceId: "d" };
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
    listOperators: vi.fn().mockResolvedValue([paired]),
    deactivateOperator: vi.fn().mockResolvedValue([inactive]),
  };
  const workspace = createWorkspace({
    openStore: async () => store as never,
    api: api as never,
    backups: { create: vi.fn(), list: vi.fn().mockResolvedValue([]), restore: vi.fn() },
  });
  return { workspace, api };
}

describe("workspace.deactivateOperator", () => {
  it("desativa pelo gestor atual e troca a lista pela resposta da API", async () => {
    const { workspace, api } = workspaceSetup();
    await workspace.initialize();
    await workspace.loadOperators();
    await workspace.deactivateOperator("ana");
    expect(api.deactivateOperator).toHaveBeenCalledWith(manager, "ana");
    expect(workspace.operators.value).toEqual([inactive]);
    expect(workspace.operatorsError.value).toBe("");
  });

  it("em falha mantém a lista e mostra o erro", async () => {
    const { workspace, api } = workspaceSetup();
    await workspace.initialize();
    await workspace.loadOperators();
    api.deactivateOperator.mockRejectedValueOnce(new Error("sem conexão"));
    await workspace.deactivateOperator("ana");
    expect(workspace.operators.value).toEqual([paired]);
    expect(workspace.operatorsError.value).toMatch(/desativar.*sem conexão/i);
  });

  it("nunca desativa a partir de uma sessão de operador", async () => {
    const { workspace, api } = workspaceSetup("OPERADOR");
    await workspace.initialize();
    await expect(workspace.deactivateOperator("ana")).rejects.toThrow(/gestor/i);
    expect(api.deactivateOperator).not.toHaveBeenCalled();
  });
});

describe("botão Desativar no painel de operadores", () => {
  afterEach(() => vi.unstubAllGlobals());

  function mountPanel(operators = [paired], loading = false) {
    const props = {
      operators,
      loading,
      error: "",
      refresh: vi.fn(),
      connect: vi.fn(),
      deactivate: vi.fn().mockResolvedValue(undefined),
    };
    return { props, wrapper: mount(OperatorsPanel, { props }) };
  }

  it("pede confirmação com o nome e desativa só quando confirmado", async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    const { wrapper, props } = mountPanel();
    await wrapper.get('[data-testid="deactivate-ana"]').trigger("click");
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Ana"));
    expect(props.deactivate).not.toHaveBeenCalled();
    await wrapper.get('[data-testid="deactivate-ana"]').trigger("click");
    expect(props.deactivate).toHaveBeenCalledWith("ana");
    wrapper.unmount();
  });

  it("não oferece desativar um operador já inativo", () => {
    const { wrapper } = mountPanel([inactive] as never);
    expect(wrapper.find('[data-testid="deactivate-ana"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
