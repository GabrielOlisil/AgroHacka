import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StockService - Análise Central de Estoque', () => {
  let stockService: StockService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      product: {
        findMany: vi.fn(),
      },
      alert: {
        findMany: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      stockMovement: {
        findMany: vi.fn(),
      },
    };

    stockService = new StockService(prismaService as PrismaService);
  });

  it('deve analisar a fazenda e gerar alertas de risco de falta e curva ABC', async () => {
    const farmId = 'farm-123';
    const mockProducts = [
      {
        id: 'p1',
        farmId,
        nome: 'Ureia 46%',
        categoria: 'Fertilizantes',
        unidadeMedida: 'sc',
        estoqueMinimo: 30,
        precoAquisicao: 150,
        validade: null,
        movements: [
          { tipo: 'ENTRADA', quantidade: 50, dataMovimento: new Date() },
          { tipo: 'SAIDA', quantidade: 10, dataMovimento: new Date() },
          { tipo: 'SAIDA', quantidade: 10, dataMovimento: new Date() },
          { tipo: 'SAIDA', quantidade: 10, dataMovimento: new Date() },
        ],
      },
    ];

    prismaService.product.findMany.mockResolvedValue(mockProducts);
    prismaService.alert.deleteMany.mockResolvedValue({ count: 0 });
    prismaService.alert.create.mockResolvedValue({ id: 'alert-1' });

    const result = await stockService.analyzeStock(farmId);

    expect(prismaService.product.findMany).toHaveBeenCalledWith({
      where: { farmId },
      include: {
        movements: {
          orderBy: { dataMovimento: 'asc' },
        },
      },
    });

    expect(result).toHaveProperty('curvaAbc');
    expect(result).toHaveProperty('alertas');
    expect(result).toHaveProperty('resumo');
    expect(result.resumo.totalInsumos).toBe(1);
    expect(result.resumo.saldoTotal).toBe(20); // 50 - 30 = 20 (abaixo do mín de 30)
  });

  it('deve reanalisar o estoque, persistir alertas criticos no banco e disparar notificacao WhatsApp', async () => {
    const farmId = 'farm-123';
    const mockProducts = [
      {
        id: 'p-ureia',
        farmId,
        nome: 'Ureia 46%',
        categoria: 'Fertilizantes',
        unidadeMedida: 'sc',
        estoqueMinimo: 100,
        precoAquisicao: 150,
        validade: null,
        movements: [
          { tipo: 'ENTRADA', quantidade: 100, dataMovimento: new Date('2026-10-01') },
          { tipo: 'SAIDA', quantidade: 30, dataMovimento: new Date('2026-10-10') },
          { tipo: 'SAIDA', quantidade: 30, dataMovimento: new Date('2026-10-15') },
          { tipo: 'SAIDA', quantidade: 30, dataMovimento: new Date('2026-10-20') },
          // Saldo = 10 sc, consumo médio = ~1.5 sc/dia -> autonomia ~6 dias (< estoqueMinimo 100) -> CRITICO
        ],
      },
    ];

    prismaService.product.findMany.mockResolvedValue(mockProducts);
    prismaService.alert.findMany.mockResolvedValue([]);
    prismaService.alert.create.mockResolvedValue({ id: 'alert-ureia-1' });

    const mockNotificationsService = {
      dispatchCriticalAlerts: vi.fn().mockResolvedValue({ totalEnviados: 1 }),
    };

    (stockService as any).notificationsService = mockNotificationsService;

    const result = await stockService.reanalyzeAndPersistAlerts(farmId);

    expect(prismaService.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          farmId,
          productId: 'p-ureia',
          tipo: 'ESTOQUE_CRITICO',
          nivelUrgencia: 'ALTA',
        }),
      }),
    );
    expect(mockNotificationsService.dispatchCriticalAlerts).toHaveBeenCalledWith(farmId);
    expect(result).toHaveProperty('alertas');
    expect(result).toHaveProperty('notificacoes');
  });
});

