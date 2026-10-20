import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService } from './sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';

describe('SyncService - Sincronização Híbrida e Heartbeat', () => {
  let syncService: SyncService;
  let prismaService: any;
  let stockService: any;

  beforeEach(() => {
    prismaService = {
      farm: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      stockMovement: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      syncLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
    };

    stockService = {
      analyzeStock: vi.fn(),
    };

    syncService = new SyncService(prismaService as PrismaService, stockService as StockService);
  });

  describe('heartbeat', () => {
    it('deve atualizar o IP e porta local da fazenda', async () => {
      const mockFarm = {
        id: 'farm-1',
        nome: 'Fazenda Modelo',
        localIp: '192.168.1.55',
        localPort: 3333,
      };

      prismaService.farm.update.mockResolvedValue(mockFarm);

      const result = await syncService.updateHeartbeat({
        farmId: 'farm-1',
        localIp: '192.168.1.55',
        localPort: 3333,
      });

      expect(prismaService.farm.update).toHaveBeenCalledWith({
        where: { id: 'farm-1' },
        data: {
          localIp: '192.168.1.55',
          localPort: 3333,
        },
      });

      expect(result.sucesso).toBe(true);
      expect(result.localIp).toBe('192.168.1.55');
    });
  });

  describe('syncData', () => {
    it('deve processar movimentações pendentes locais e retornar atualizações do servidor', async () => {
      const farmId = 'farm-1';
      const lastSyncTimestamp = new Date('2026-10-15T00:00:00Z');

      const pendingMovements = [
        {
          id: 'mov-uuid-1',
          farmId,
          productId: 'prod-1',
          tipo: 'SAIDA' as const,
          quantidade: 5,
          dataMovimento: new Date('2026-10-16T10:00:00Z'),
          destino: 'Talhão 02',
          responsavel: 'Carlos - Operador',
          updatedAt: new Date('2026-10-16T10:00:00Z'),
        },
      ];

      prismaService.stockMovement.upsert.mockResolvedValue({ id: 'mov-uuid-1' });
      prismaService.stockMovement.findMany.mockResolvedValue([]);
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.syncLog.create.mockResolvedValue({ id: 'sync-1' });

      stockService.analyzeStock.mockResolvedValue({
        resumo: { totalInsumos: 1 },
        alertas: [{ id: 'a1', nivel: 'URGENTE', titulo: 'Estoque baixo' }],
      });

      const result = await syncService.syncData({
        farmId,
        deviceId: 'dev-1',
        lastSyncTimestamp: lastSyncTimestamp.toISOString(),
        pendingMovements,
      });

      expect(prismaService.stockMovement.upsert).toHaveBeenCalled();
      expect(stockService.analyzeStock).toHaveBeenCalledWith(farmId);
      expect(result.syncedCount).toBe(1);
      expect(result).toHaveProperty('serverTimestamp');
      expect(result.alerts).toHaveLength(1);
    });

    it('deve sincronizar com sucesso mesmo se a lista de movimentações pendentes for vazia', async () => {
      const farmId = 'farm-1';

      prismaService.stockMovement.findMany.mockResolvedValue([]);
      prismaService.product.findMany.mockResolvedValue([]);
      prismaService.syncLog.create.mockResolvedValue({ id: 'sync-1' });

      stockService.analyzeStock.mockResolvedValue({
        resumo: { totalInsumos: 0 },
        alertas: [],
      });

      const result = await syncService.syncData({
        farmId,
        pendingMovements: [],
      });

      expect(prismaService.stockMovement.upsert).not.toHaveBeenCalled();
      expect(result.syncedCount).toBe(0);
      expect(result).toHaveProperty('serverTimestamp');
    });
  });
});
