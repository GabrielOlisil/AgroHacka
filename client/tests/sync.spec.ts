import { describe, expect, it, vi } from "vitest";
import { SyncCoordinator } from "../src/offline/sync";
import { createApi } from "../src/api/client";

const session = {
  role: "OPERADOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Ana",
  deviceId: "d",
};
const movement = {
  id: "m",
  farmId: "f",
  productId: "p",
  tipo: "SAIDA" as const,
  quantidade: 5,
  dataMovimento: "2026-10-16T10:00:00Z",
  responsavel: "Ana",
};
const response = {
  protocolVersion: 2 as const,
  results: [{ id: movement.id, status: "ACCEPTED" as const, movement }],
  divergences: [],
  sucesso: true,
  serverTimestamp: "2026-10-16T12:00:00Z",
  syncedCount: 1,
  newProducts: [],
  newMovements: [],
  alerts: [],
  resumo: {},
};

describe("sincronização offline com a API existente", () => {
  const setup = () => {
    const store = {
      pending: vi.fn().mockResolvedValue([movement]),
      applyRemote: vi.fn().mockResolvedValue(undefined),
      applySyncResponse: vi.fn().mockResolvedValue(undefined),
      setLastSync: vi.fn().mockResolvedValue(undefined),
    };
    const transport = vi.fn().mockResolvedValue(response);
    return {
      store,
      transport,
      coordinator: new SyncCoordinator(store as never, transport),
    };
  };
  it("envia pendências com os mesmos UUIDs e sem avançar cursor inseguro do backend", async () => {
    const { store, transport, coordinator } = setup();
    await coordinator.run(session);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: "f",
        deviceId: "d",
        pendingMovements: [movement],
      }),
      session,
    );
    expect(transport.mock.calls[0]?.[0]).not.toHaveProperty(
      "lastSyncTimestamp",
    );
    expect(store.applySyncResponse).toHaveBeenCalledWith(
      "f",
      expect.objectContaining({
        results: [
          {
            id: movement.id,
            status: "ACCEPTED",
            movement: {
              ...movement,
              dataMovimento: new Date(movement.dataMovimento).toISOString(),
            },
          },
        ],
      }),
      [movement],
    );
  });
  it("mantém fila se a rede falhar ou a confirmação do lote for incompleta", async () => {
    const { store, transport, coordinator } = setup();
    transport.mockRejectedValueOnce(new Error("offline"));
    await expect(coordinator.run(session)).rejects.toThrow("offline");
    transport.mockResolvedValueOnce({ ...response, syncedCount: 0 });
    await expect(coordinator.run(session)).rejects.toThrow(/confirma/i);
    expect(store.applySyncResponse).not.toHaveBeenCalled();
  });
  it("não confirma nada quando a transação local falha", async () => {
    const { store, coordinator } = setup();
    store.applySyncResponse.mockRejectedValue(new Error("disco cheio"));
    await expect(coordinator.run(session)).rejects.toThrow("disco cheio");
    expect(store.setLastSync).not.toHaveBeenCalled();
  });
  it("impede sobreposição de sincronizações e mantém novos registros fora da confirmação", async () => {
    const { store, transport, coordinator } = setup();
    let finish!: (value: typeof response) => void;
    transport.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = coordinator.run(session);
    await Promise.resolve();
    await expect(coordinator.run(session)).rejects.toThrow(/andamento/i);
    finish(response);
    await first;
    expect(store.applySyncResponse.mock.calls[0]?.[2]).toEqual([movement]);
  });
  it("baixa registros mesmo com fila vazia", async () => {
    const { store, transport, coordinator } = setup();
    store.pending.mockResolvedValue([]);
    transport.mockResolvedValue({ ...response, syncedCount: 0, results: [] });
    await coordinator.run(session);
    expect(store.applySyncResponse).toHaveBeenCalledWith(
      "f",
      expect.objectContaining({ results: [] }),
      [],
    );
  });
});

describe("cliente HTTP openapi-fetch", () => {
  it("não aceita login bem-sucedido sem token ou pareamento sem identificador do dispositivo", async () => {
    const api = createApi("http://localhost:3000", async () =>
      Response.json({
        user: {
          id: "u",
          role: "GESTOR",
          farmId: "f",
          farmNome: "Fazenda",
          nome: "Ana",
        },
      }),
    );
    await expect(
      api.login({ email: "a@b.com", senha: "senha" }),
    ).rejects.toThrow();
    const connectApi = createApi("http://localhost:3000", async () =>
      Response.json({
        sucesso: true,
        farmId: "f",
        farmNome: "Fazenda",
        nomeOperador: "Ana",
      }),
    );
    await expect(
      connectApi.connect({ tokenOrCode: "AGRO-1234" }),
    ).rejects.toThrow();
  });
  it("serializa datas ISO corretas apesar da lacuna do contrato gerado e envia token", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const api = createApi("http://localhost:3000", fetcher);
    await api.sync(
      { farmId: "f", pendingMovements: [movement] },
      { ...session, accessToken: "token" },
    );
    const request = fetcher.mock.calls[0]?.[0] as unknown as Request;
    expect(request.url).toBe("http://localhost:3000/sync");
    expect(request.headers.get("Authorization")).toBe("Bearer token");
    expect((await request.json()).pendingMovements[0].dataMovimento).toBe(
      movement.dataMovimento,
    );
  });
  it.each([
    null,
    {},
    { ...response, sucesso: false },
    { ...response, newMovements: [{ ...movement, farmId: "outra" }] },
    { ...response, newProducts: null },
  ])("rejeita resposta inválida sem aceitar confirmação", async (value) => {
    const fetcher = async () =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    await expect(
      createApi("http://localhost:3000", fetcher).sync(
        { farmId: "f", pendingMovements: [] },
        session,
      ),
    ).rejects.toThrow();
  });
  it("mantém código HTTP e mensagem do servidor para tratamento de sessão", async () => {
    const api = createApi(
      "http://localhost:3000",
      async () =>
        new Response(JSON.stringify({ message: "Token expirado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    );
    await expect(api.sync({ farmId: "f" }, session)).rejects.toMatchObject({
      status: 401,
      message: "Token expirado",
    });
  });
  it("usa contrato existente também para login, cadastro e pareamento", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      if (request.url.endsWith("/devices/connect"))
        return Response.json({
          sucesso: true,
          deviceId: "d",
          farmId: "f",
          farmNome: "Fazenda",
          nomeOperador: "Ana",
          localIp: null,
          localPort: 3333,
        });
      return Response.json({
        accessToken: "token",
        user: {
          id: "u",
          nome: "Ana",
          email: "a@b.com",
          role: "GESTOR",
          farmId: "f",
          farmNome: "Fazenda",
        },
      });
    });
    const api = createApi("http://localhost:3000", fetcher);
    expect(await api.login({ email: "a@b.com", senha: "senha" })).toMatchObject(
      { role: "GESTOR", farmId: "f", accessToken: "token" },
    );
    expect(
      await api.register({
        nome: "Ana",
        email: "a@b.com",
        senha: "senha",
        nomeFazenda: "Fazenda",
      }),
    ).toMatchObject({ role: "GESTOR" });
    expect(await api.connect({ tokenOrCode: "AGRO-1234" })).toMatchObject({
      role: "OPERADOR",
      nome: "Ana",
      deviceId: "d",
    });
  });
});
