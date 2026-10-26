import { describe, expect, it, vi } from "vitest";
import { createWorkspace } from "../src/workspace";
import type { SyncResponse } from "../src/offline/types";

const sessionOperador = {
  role: "OPERADOR" as const,
  farmId: "farm-agro-01",
  farmNome: "Fazenda IFRO",
  nome: "Lucas Operador",
  deviceId: "dev-mobile-01",
};


describe("Tarefas 6.2 & 6.3: Validação de Reanálise em Tempo Real e Modo Offline", () => {
  it("6.2: Deve recalcular alertas em tempo real ao registrar saída crítica de insumo", async () => {
    // Cenário: Ureia 46% com estoque inicial de 50 sc e estoque mínimo de 30 sc.
    // Histórico de saídas diárias: 10 sc/dia.
    // Nova saída de 30 sc deixa o saldo em 10 sc -> Autonomia cai para 1 dia (< 3 dias) -> Status CRITICO
    const productUreia = {
      id: "prod-ureia",
      farmId: "farm-agro-01",
      nome: "Ureia 46%",
      categoria: "Fertilizantes",
      unidadeMedida: "sc",
      estoqueMinimo: 30,
      precoAquisicao: 150,
      validade: null,
      lote: "L-2026",
      fornecedor: "AgroFértil",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    const now = new Date();
    const dayMs = 86400000;

    let localMovements: any[] = [
      {
        id: "mov-ent-1",
        farmId: "farm-agro-01",
        productId: "prod-ureia",
        tipo: "ENTRADA",
        quantidade: 50,
        dataMovimento: new Date(now.getTime() - 10 * dayMs).toISOString(),
        responsavel: "Carlos Gestor",
      },
      {
        id: "mov-sai-1",
        farmId: "farm-agro-01",
        productId: "prod-ureia",
        tipo: "SAIDA",
        quantidade: 10,
        dataMovimento: new Date(now.getTime() - 2 * dayMs).toISOString(),
        responsavel: "Lucas Operador",
      },
    ];


    const store = {
      loadSession: vi.fn().mockResolvedValue(sessionOperador),
      saveSession: vi.fn(),
      clearSession: vi.fn(),
      snapshot: vi.fn().mockImplementation(async () => ({
        products: [productUreia],
        movements: localMovements,
      })),
      pending: vi.fn().mockResolvedValue([]),
      lastSync: vi.fn().mockResolvedValue(null),
      saveAlerts: vi.fn(),
      recordMovement: vi.fn().mockImplementation(async (_session, input) => {
        localMovements = [
          ...localMovements,
          { ...input, farmId: _session.farmId, responsavel: _session.nome },
        ];
      }),
      draftId: vi.fn().mockResolvedValue("draft-mov-critical"),
      syncReviews: vi.fn().mockResolvedValue([]),
    };


    const api = {
      sync: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      connect: vi.fn(),
      pairing: vi.fn(),
      updateLocalIp: vi.fn(),
    };

    const backups = {
      create: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      restore: vi.fn().mockResolvedValue(undefined),
    };

    const workspace = createWorkspace({
      openStore: async () => store as never,
      api: api as never,
      backups,
    });

    await workspace.initialize();

    // Verificação do estado inicial (saldo = 40 sc, acima do mínimo de 30)
    const saldoInicial = workspace.analysis.value.products.find((p) => p.id === "prod-ureia")?.saldo;
    expect(saldoInicial).toBe(40);

    // Operador registra uma baixa rápida de 30 sc (saldo vai de 40 para 10 sc)
    await workspace.record({
      productId: "prod-ureia",
      tipo: "SAIDA",
      quantidade: 30,
      dataMovimento: now.toISOString(),
    });

    // 1. O saldo é recalculado imediatamente na interface
    const produtoAtualizado = workspace.analysis.value.products.find((p) => p.id === "prod-ureia");
    expect(produtoAtualizado?.saldo).toBe(10);

    // 2. O alerta de runout deve ser recalculado imediatamente para nível CRÍTICO / URGENTE
    const alertas = workspace.analysis.value.alerts;
    const alertaUreia = alertas.find((a) => a.id.includes("prod-ureia") || a.titulo.includes("Ureia"));
    expect(alertaUreia).toBeDefined();
    expect(alertaUreia?.nivel).toBe("URGENTE");

    // 3. Os alertas recalculados foram salvos no armazenamento local
    expect(store.saveAlerts).toHaveBeenCalledWith(
      "farm-agro-01",
      expect.arrayContaining([expect.objectContaining({ nivel: "URGENTE" })]),
    );
  });

  it("6.3: Deve manter funcionamento 100% offline em modo avião e sincronizar sem duplicidade ao reconectar", async () => {
    let localPending: any[] = [];
    let localMovements: any[] = [];
    const productDiesel = {
      id: "prod-diesel",
      farmId: "farm-agro-01",
      nome: "Óleo Diesel S10",
      categoria: "Combustível",
      unidadeMedida: "L",
      estoqueMinimo: 500,
      precoAquisicao: 6.2,
      validade: null,
      lote: null,
      fornecedor: "Petro",
      updatedAt: "2026-10-01T00:00:00Z",
    };

    const store = {
      loadSession: vi.fn().mockResolvedValue(sessionOperador),
      saveSession: vi.fn(),
      clearSession: vi.fn(),
      snapshot: vi.fn().mockImplementation(async () => ({
        products: [productDiesel],
        movements: localMovements,
      })),
      pending: vi.fn().mockImplementation(async () => localPending),
      lastSync: vi.fn().mockResolvedValue(null),
      saveAlerts: vi.fn(),
      recordMovement: vi.fn().mockImplementation(async (_sess, input) => {
        const item = { ...input, farmId: _sess.farmId, responsavel: _sess.nome };
        localMovements = [...localMovements, item];
        localPending = [...localPending, item];
      }),
      draftId: vi.fn().mockResolvedValue("draft-offline-mov-1"),
      syncReviews: vi.fn().mockResolvedValue([]),
      applyRemote: vi.fn(),
      applySyncResponse: vi.fn().mockImplementation(async (_farmId, _res) => {
        // Quando a sincronização é bem-sucedida, as pendências são liquidadas
        localPending = [];
      }),
      setLastSync: vi.fn(),

    };

    // Simulando MODO AVIÃO / REDE DESCONECTADA: api.sync rejeita com erro de rede
    const mockSync = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const api = {
      sync: mockSync,
      login: vi.fn(),
      register: vi.fn(),
      connect: vi.fn(),
      pairing: vi.fn(),
      updateLocalIp: vi.fn(),
    };

    const backups = {
      create: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      restore: vi.fn().mockResolvedValue(undefined),
    };

    const workspace = createWorkspace({
      openStore: async () => store as never,
      api: api as never,
      backups,
    });

    await workspace.initialize();

    // 1. Em campo, 100% offline, o operador registra abastecimento de trator: SAIDA de 200L
    const movDate = new Date().toISOString();
    await workspace.record({
      id: "offline-uuid-diesel-1",
      productId: "prod-diesel",
      tipo: "SAIDA",
      quantidade: 200,
      dataMovimento: movDate,
    });

    // 2. Saldo e pendência local atualizados mesmo sem sinal
    expect(workspace.pendingCount.value).toBe(1);
    expect(localMovements).toHaveLength(1);

    // 3. Tentativa de sincronização durante modo avião
    await workspace.sync();
    // O aplicativo não quebra, avisa o usuário preservando os registros locais
    expect(workspace.error.value).toContain("Sincronização não concluída");
    expect(workspace.error.value).toContain("Os registros locais foram preservados");
    expect(workspace.pendingCount.value).toBe(1); // Pendência permanece intacta

    // 4. OPERADOR RETORNA À SEDE (REDE RESTABELECIDA)
    // A API agora aceita o lote e confirma a movimentação
    const mockSuccessResponse: SyncResponse = {
      protocolVersion: 2,
      results: [
        {
          id: "offline-uuid-diesel-1",
          status: "ACCEPTED",
          movement: {
            id: "offline-uuid-diesel-1",
            farmId: "farm-agro-01",
            productId: "prod-diesel",
            tipo: "SAIDA",
            quantidade: 200,
            dataMovimento: movDate,
            responsavel: "Lucas Operador",
          },
        },
      ],
      divergences: [],
      sucesso: true,
      serverTimestamp: new Date().toISOString(),
      syncedCount: 1,
      newProducts: [productDiesel],
      newMovements: [
        {
          id: "offline-uuid-diesel-1",
          farmId: "farm-agro-01",
          productId: "prod-diesel",
          tipo: "SAIDA",
          quantidade: 200,
          dataMovimento: movDate,
          responsavel: "Lucas Operador",
        },
      ],
    };



    mockSync.mockResolvedValueOnce(mockSuccessResponse);

    // Sincronização automática pós-reconexão
    await workspace.sync();

    // 5. Verificações pós-sincronização:
    // Pendências zeradas
    expect(workspace.pendingCount.value).toBe(0);
    // Erro limpo
    expect(workspace.error.value).toBe("");
    // Movimento enviado com UUID estável, sem duplicidade
    expect(mockSync).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: "farm-agro-01",
        pendingMovements: [
          expect.objectContaining({
            id: "offline-uuid-diesel-1",
            quantidade: 200,
          }),
        ],
      }),
      expect.objectContaining({
        farmId: "farm-agro-01",
        role: "OPERADOR",
      }),
    );
  });
});

