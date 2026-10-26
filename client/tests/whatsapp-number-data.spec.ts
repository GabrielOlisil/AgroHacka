import { describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { createWorkspace } from "../src/workspace";

const manager = {
  role: "GESTOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Gestor",
  accessToken: "signed",
  telefone: "+5569999999999",
};

describe("api.updateTelefone", () => {
  it("envia o número ao PATCH autenticado e devolve o número normalizado pelo servidor", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe("/auth/telefone");
      expect(req.method).toBe("PATCH");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      expect(await req.json()).toEqual({ telefone: "+55 69 98888-7777" });
      return Response.json({ telefone: "+5569988887777" });
    });

    const result = await createApi("http://api.test", fetcher).updateTelefone(
      manager,
      "  +55 69 98888-7777  ",
    );

    expect(result).toBe("+5569988887777");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["", "   "])(
    "número vazio (%j) desativa os alertas: envia null e devolve undefined",
    async (vazio) => {
      const fetcher = vi.fn<typeof fetch>(async (request) => {
        expect(await (request as Request).json()).toEqual({ telefone: null });
        return Response.json({});
      });

      const result = await createApi("http://api.test", fetcher).updateTelefone(
        manager,
        vazio,
      );

      expect(result).toBeUndefined();
    },
  );

  it("repassa a orientação do servidor quando o número é inválido (400)", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json(
        { message: "Informe o WhatsApp com o código do país." },
        { status: 400 },
      ),
    );
    await expect(api.updateTelefone(manager, "abc")).rejects.toMatchObject({
      status: 400,
      message: "Informe o WhatsApp com o código do país.",
    });
  });

  it.each([401, 403])("preserva o status HTTP %s como erro", async (status) => {
    const api = createApi("http://api.test", async () =>
      Response.json({ message: "negado" }, { status }),
    );
    await expect(
      api.updateTelefone(manager, "+5569999999999"),
    ).rejects.toMatchObject({ status });
  });

  it.each([null, "texto", [], { telefone: 123 }, { telefone: "" }])(
    "rejeita resposta malformada (%j)",
    async (body) => {
      const api = createApi("http://api.test", async () => Response.json(body));
      await expect(
        api.updateTelefone(manager, "+5569999999999"),
      ).rejects.toThrow();
    },
  );

  it("recusa operador e token ausente antes de chamar a rede", async () => {
    const fetcher = vi.fn();
    const api = createApi("http://api.test", fetcher);
    await expect(
      api.updateTelefone({ ...manager, role: "OPERADOR" }, "+5569999999999"),
    ).rejects.toThrow(/gestor/i);
    await expect(
      api.updateTelefone({ ...manager, accessToken: undefined }, "+5569999999999"),
    ).rejects.toThrow(/token/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("workspace.updateTelefone", () => {
  function setup(session: unknown) {
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
      updateTelefone: vi.fn(),
    };
    const workspace = createWorkspace({
      openStore: async () => store as never,
      api: api as never,
      backups: {
        create: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
        restore: vi.fn(),
      },
    });
    return { workspace, api, store };
  }

  it("troca o número: atualiza a sessão na tela e no SQLite local", async () => {
    const { workspace, api, store } = setup(manager);
    api.updateTelefone.mockResolvedValue("+5569988887777");
    await workspace.initialize();

    const result = await workspace.updateTelefone("+55 69 98888-7777");

    expect(api.updateTelefone).toHaveBeenCalledWith(manager, "+55 69 98888-7777");
    expect(result).toBe("+5569988887777");
    expect(workspace.session.value?.telefone).toBe("+5569988887777");
    expect(store.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: "+5569988887777" }),
    );
  });

  it("desativar remove o número da sessão", async () => {
    const { workspace, api, store } = setup(manager);
    api.updateTelefone.mockResolvedValue(undefined);
    await workspace.initialize();

    await workspace.updateTelefone("");

    expect(workspace.session.value).not.toHaveProperty("telefone");
    expect(store.saveSession.mock.calls[0]![0]).not.toHaveProperty("telefone");
  });

  it("se a API recusar, a sessão e o SQLite ficam intactos", async () => {
    const { workspace, api, store } = setup(manager);
    api.updateTelefone.mockRejectedValue(new Error("Número inválido"));
    await workspace.initialize();

    await expect(workspace.updateTelefone("abc")).rejects.toThrow(
      "Número inválido",
    );

    expect(workspace.session.value?.telefone).toBe("+5569999999999");
    expect(store.saveSession).not.toHaveBeenCalled();
  });

  it("recusa operador e sessão ausente", async () => {
    const operator = { ...manager, role: "OPERADOR" as const, deviceId: "d" };
    const first = setup(operator);
    await first.workspace.initialize();
    await expect(first.workspace.updateTelefone("+5569999999999")).rejects.toThrow(
      /gestor/i,
    );
    const second = setup(null);
    await second.workspace.initialize();
    await expect(second.workspace.updateTelefone("+5569999999999")).rejects.toThrow(
      /gestor/i,
    );
    expect(first.api.updateTelefone).not.toHaveBeenCalled();
    expect(second.api.updateTelefone).not.toHaveBeenCalled();
  });

  it("não recria a sessão se o gestor sair enquanto a requisição está no ar", async () => {
    const { workspace, api, store } = setup(manager);
    let finish!: (value: string) => void;
    api.updateTelefone.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    await workspace.initialize();

    const pending = workspace.updateTelefone("+5569988887777");
    await workspace.logout();
    finish("+5569988887777");
    await pending;

    expect(workspace.session.value).toBeNull();
    expect(store.saveSession).not.toHaveBeenCalled();
  });
});
