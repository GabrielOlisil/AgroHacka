import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { LocalStore } from "../src/offline/local-store";
import { parseSession } from "../src/offline/types";
import type { SqlDatabase, Statement } from "../src/offline/database";
import { createWorkspace } from "../src/workspace";

const manager = {
  role: "GESTOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Gestor",
  accessToken: "signed",
  telefone: "+5569999999999",
};
const authResponse = (telefone?: unknown) => ({
  accessToken: "signed",
  user: {
    id: "u1",
    nome: "Gestor",
    email: "g@fazenda.com",
    role: "GESTOR",
    farmId: "f",
    farmNome: "Fazenda",
    ...(telefone === undefined ? {} : { telefone }),
  },
});

describe("sessão com o WhatsApp do gestor", () => {
  it("mantém o telefone informado, sem espaços nas pontas", () => {
    expect(parseSession({ ...manager, telefone: "  +5569999999999 " })).toMatchObject(
      { telefone: "+5569999999999" },
    );
  });

  it.each([undefined, null, "", "   ", 123, {}])(
    "descarta telefone ausente, em branco ou inválido (%s)",
    (telefone) => {
      expect(parseSession({ ...manager, telefone })).not.toHaveProperty(
        "telefone",
      );
    },
  );

  it("sobrevive ao reinício do app: grava e lê no SQLite real", async () => {
    const db = new DatabaseSync(":memory:");
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
        for (const s of statements) db.prepare(s.sql).run(...(s.values ?? []));
      },
    };
    const store = new LocalStore(adapter);

    await store.saveSession(manager);

    expect(await store.loadSession()).toMatchObject({
      telefone: "+5569999999999",
    });
  });
});

describe("login e cadastro trazem o WhatsApp para a sessão", () => {
  it("login: mapeia user.telefone", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json(authResponse("+5569999999999")),
    );
    const session = await api.login({ email: "g@fazenda.com", senha: "x" });
    expect(session.telefone).toBe("+5569999999999");
  });

  it("login: sem telefone a sessão não ganha a propriedade", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json(authResponse()),
    );
    const session = await api.login({ email: "g@fazenda.com", senha: "x" });
    expect(session).not.toHaveProperty("telefone");
  });

  it("cadastro: mapeia user.telefone", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json(authResponse("+5569988887777"), { status: 201 }),
    );
    const session = await api.register({
      nome: "Gestor",
      email: "g@fazenda.com",
      senha: "x",
      nomeFazenda: "Fazenda",
      telefone: "+5569988887777",
    });
    expect(session.telefone).toBe("+5569988887777");
  });
});

describe("api.testWhatsApp", () => {
  it("chama o endpoint autenticado com o número do gestor e informa envio real", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe("/notifications/test-whatsapp");
      expect(req.method).toBe("POST");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      expect(await req.json()).toEqual({ paraTelefone: "+5569999999999" });
      return Response.json({ sucesso: true, messageSid: "SM_1", status: "queued" });
    });

    const result = await createApi("http://api.test", fetcher).testWhatsApp(
      manager,
      "+5569999999999",
    );

    expect(result).toEqual({ simulado: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("avisa quando o servidor respondeu em modo de simulação (nada foi enviado de verdade)", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json({ sucesso: true, modo: "SIMULADO" }),
    );
    expect(await api.testWhatsApp(manager, "+5569999999999")).toEqual({
      simulado: true,
    });
  });

  it("trata sucesso:false (HTTP 200) como falha e repassa o motivo", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json({ sucesso: false, erro: "Número fora do Sandbox" }),
    );
    await expect(api.testWhatsApp(manager, "+5569999999999")).rejects.toThrow(
      "Número fora do Sandbox",
    );
  });

  it("usa uma mensagem padrão quando a falha não traz motivo", async () => {
    const api = createApi("http://api.test", async () =>
      Response.json({ sucesso: false }),
    );
    await expect(api.testWhatsApp(manager, "+5569999999999")).rejects.toThrow(
      /não foi enviada/i,
    );
  });

  it.each([null, "texto", [], {}, { sucesso: "true" }])(
    "rejeita resposta malformada (%j)",
    async (body) => {
      const api = createApi("http://api.test", async () => Response.json(body));
      await expect(
        api.testWhatsApp(manager, "+5569999999999"),
      ).rejects.toThrow();
    },
  );

  it.each([401, 403, 400])(
    "preserva o status HTTP %s como erro, sem fingir sucesso",
    async (status) => {
      const api = createApi("http://api.test", async () =>
        Response.json({ message: "negado" }, { status }),
      );
      await expect(
        api.testWhatsApp(manager, "+5569999999999"),
      ).rejects.toMatchObject({ status });
    },
  );

  it("recusa operador, token ausente e número em branco antes de chamar a rede", async () => {
    const fetcher = vi.fn();
    const api = createApi("http://api.test", fetcher);
    await expect(
      api.testWhatsApp({ ...manager, role: "OPERADOR" }, "+5569999999999"),
    ).rejects.toThrow(/gestor/i);
    await expect(
      api.testWhatsApp({ ...manager, accessToken: undefined }, "+5569999999999"),
    ).rejects.toThrow(/token/i);
    await expect(api.testWhatsApp(manager, "   ")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("workspace.testWhatsApp", () => {
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
      testWhatsApp: vi.fn().mockResolvedValue({ simulado: false }),
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
    return { workspace, api };
  }

  it("testa o número cadastrado do gestor logado", async () => {
    const { workspace, api } = setup(manager);
    await workspace.initialize();

    const result = await workspace.testWhatsApp();

    expect(api.testWhatsApp).toHaveBeenCalledWith(manager, "+5569999999999");
    expect(result).toEqual({ simulado: false });
  });

  it("exige WhatsApp cadastrado", async () => {
    const { telefone: _omit, ...semTelefone } = manager;
    const { workspace, api } = setup(semTelefone);
    await workspace.initialize();

    await expect(workspace.testWhatsApp()).rejects.toThrow(/whatsapp/i);
    expect(api.testWhatsApp).not.toHaveBeenCalled();
  });

  it("recusa operador e sessão ausente", async () => {
    const operator = { ...manager, role: "OPERADOR" as const, deviceId: "d" };
    const first = setup(operator);
    await first.workspace.initialize();
    await expect(first.workspace.testWhatsApp()).rejects.toThrow(/gestor/i);

    const second = setup(null);
    await second.workspace.initialize();
    await expect(second.workspace.testWhatsApp()).rejects.toThrow(/gestor/i);
    expect(first.api.testWhatsApp).not.toHaveBeenCalled();
    expect(second.api.testWhatsApp).not.toHaveBeenCalled();
  });
});
