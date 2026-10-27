import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { analyzeStockInventory } from '../stock-engine/stock-engine';

const farmId = 'farm-123';
const NOW = new Date('2026-10-20T15:00:00.000Z');
const at = (days: number) => new Date(Date.UTC(2026, 9, 20 + days, 12));

type Mov = { tipo: 'ENTRADA' | 'SAIDA'; quantidade: number; dataMovimento: Date };
const product = (id: string, overrides: Record<string, unknown>, movements: Mov[]) => ({
  id,
  farmId,
  nome: id,
  categoria: 'Teste',
  unidadeMedida: 'un',
  estoqueMinimo: 0,
  precoAquisicao: 10,
  validade: null,
  ...overrides,
  movements: movements.map((m, i) => ({ id: `${id}-m${i}`, farmId, productId: id, responsavel: 'Ana', ...m })),
});

// Ureia: saldo 10 com mínimo 30 -> FALTA urgente.
const ureia = product('p-ureia', { unidadeMedida: 'sc', estoqueMinimo: 30 }, [
  { tipo: 'ENTRADA', quantidade: 40, dataMovimento: at(-10) },
  { tipo: 'SAIDA', quantidade: 30, dataMovimento: at(-1) },
]);
// Diesel: 3 retiradas normais e um pico -> ANOMALIA de atenção; autonomia longa.
const diesel = product('p-diesel', { unidadeMedida: 'L' }, [
  { tipo: 'ENTRADA', quantidade: 50000, dataMovimento: at(-20) },
  { tipo: 'SAIDA', quantidade: 60, dataMovimento: at(-4) },
  { tipo: 'SAIDA', quantidade: 60, dataMovimento: at(-3) },
  { tipo: 'SAIDA', quantidade: 60, dataMovimento: at(-2) },
  { tipo: 'SAIDA', quantidade: 950, dataMovimento: at(-1) },
]);
// MAP: entrada há 90 dias sem saída -> PARADO informativo.
const map = product('p-map', { unidadeMedida: 't', precoAquisicao: 4200 }, [
  { tipo: 'ENTRADA', quantidade: 35, dataMovimento: at(-90) },
]);

describe('StockService: análise pelo motor completo (tarefa 10.3)', () => {
  let stockService: StockService;
  let prisma: any;
  let notifications: { dispatchCriticalAlerts: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = {
      product: { findMany: vi.fn().mockResolvedValue([ureia, diesel, map]) },
      alert: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    notifications = { dispatchCriticalAlerts: vi.fn().mockResolvedValue({ totalEnviados: 1 }) };
    stockService = new StockService(prisma as PrismaService, notifications as never);
  });

  describe('analyzeStock', () => {
    it('busca só a fazenda pedida', async () => {
      await stockService.analyzeStock(farmId, NOW);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { farmId },
        include: { movements: true },
      });
    });

    it('devolve exatamente o resultado do motor integrado', async () => {
      const result = await stockService.analyzeStock(farmId, NOW);
      const expected = analyzeStockInventory(
        [ureia, diesel, map].map(({ movements: _m, ...p }) => p),
        [ureia, diesel, map].flatMap((p) => p.movements),
        NOW,
      );
      expect(result).toEqual(expected);
    });

    it('agrupa saldos por unidade em vez de somar sacas, litros e toneladas', async () => {
      const result = await stockService.analyzeStock(farmId, NOW);
      expect(result.balancesByUnit).toEqual({ sc: 10, L: 50000 - 1130, t: 35 });
      expect(result).not.toHaveProperty('resumo');
    });

    it('inclui estoque parado, excesso e anomalia, que o caminho antigo não via', async () => {
      const { alerts } = await stockService.analyzeStock(farmId, NOW);
      // Diesel: 48.870 L a 226 L/dia dá ~216 dias, acima da referência de 90.
      expect(alerts.map((a) => a.id)).toEqual([
        'FALTA:p-ureia',
        'ANOMALIA:p-diesel',
        'EXCESSO:p-diesel',
        'PARADO:p-map',
      ]);
    });

    it('fazenda sem produtos devolve análise vazia', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      const result = await stockService.analyzeStock(farmId, NOW);
      expect(result).toMatchObject({ products: [], alerts: [], totalValue: 0, balancesByUnit: {} });
    });
  });

  describe('reanalyzeAndPersistAlerts', () => {
    const existing = (productId: string, tipo: string, nivelUrgencia: string) => ({
      id: `db-${productId}-${tipo}`,
      farmId,
      productId,
      tipo,
      nivelUrgencia,
      resolvido: false,
    });

    it('grava urgentes e de atenção com o tipo certo; informativos ficam só na análise', async () => {
      await stockService.reanalyzeAndPersistAlerts(farmId, NOW);
      const created = prisma.alert.create.mock.calls.map(([arg]: any) => arg.data);
      expect(created).toEqual([
        expect.objectContaining({ productId: 'p-ureia', tipo: 'ESTOQUE_CRITICO', nivelUrgencia: 'ALTA' }),
        expect.objectContaining({ productId: 'p-diesel', tipo: 'CONSUMO_ANOMALO', nivelUrgencia: 'MEDIA' }),
      ]);
      expect(notifications.dispatchCriticalAlerts).toHaveBeenCalledWith(farmId);
    });

    it('não duplica alerta que continua aberto no mesmo nível', async () => {
      prisma.alert.findMany.mockResolvedValue([
        existing('p-ureia', 'ESTOQUE_CRITICO', 'ALTA'),
        existing('p-diesel', 'CONSUMO_ANOMALO', 'MEDIA'),
      ]);
      await stockService.reanalyzeAndPersistAlerts(farmId, NOW);
      expect(prisma.alert.create).not.toHaveBeenCalled();
      expect(prisma.alert.update).not.toHaveBeenCalled();
      expect(prisma.alert.updateMany).not.toHaveBeenCalled();
    });

    it('alerta que sobe de atenção para urgente é atualizado e volta a ser notificável', async () => {
      prisma.alert.findMany.mockResolvedValue([existing('p-ureia', 'ESTOQUE_CRITICO', 'MEDIA')]);
      await stockService.reanalyzeAndPersistAlerts(farmId, NOW);
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'db-p-ureia-ESTOQUE_CRITICO' },
        data: expect.objectContaining({ nivelUrgencia: 'ALTA', notificadoWhatsapp: false }),
      });
      expect(prisma.alert.create).toHaveBeenCalledTimes(1); // só a anomalia do diesel é nova
    });

    it('resolve alertas cuja situação deixou de existir, sem tocar nos tipos que não gerencia', async () => {
      prisma.alert.findMany.mockResolvedValue([
        existing('p-map', 'RISCO_VENCIMENTO', 'MEDIA'),
        existing('p-diesel', 'ESTOQUE_CRITICO', 'ALTA'),
        existing('p-map', 'OUTRO', 'BAIXA'),
        { ...existing('x', 'OUTRO', 'BAIXA'), productId: null },
      ]);
      await stockService.reanalyzeAndPersistAlerts(farmId, NOW);
      expect(prisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['db-p-map-RISCO_VENCIMENTO', 'db-p-diesel-ESTOQUE_CRITICO'] } },
        data: { resolvido: true },
      });
    });

    it('fazenda sem produtos resolve todos os alertas gerenciados abertos', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.alert.findMany.mockResolvedValue([existing('p-ureia', 'ESTOQUE_CRITICO', 'ALTA')]);
      await stockService.reanalyzeAndPersistAlerts(farmId, NOW);
      expect(prisma.alert.create).not.toHaveBeenCalled();
      expect(prisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['db-p-ureia-ESTOQUE_CRITICO'] } },
        data: { resolvido: true },
      });
    });

    it('funciona sem serviço de notificações', async () => {
      const service = new StockService(prisma as PrismaService);
      const result = await service.reanalyzeAndPersistAlerts(farmId, NOW);
      expect(result.notificacoes).toBeNull();
    });
  });
});
