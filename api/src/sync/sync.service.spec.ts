import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { SyncService } from './sync.service';
import type { SyncIdentity } from '../auth/auth.service';

const identity: SyncIdentity = {
  actorId: 'user-1',
  farmId: 'farm-1',
  role: 'GESTOR',
  nome: 'Ana',
};
describe('SyncService - authenticated sync', () => {
  const update = vi.fn();
  const create = vi.fn();
  const receipt = vi.fn();
  const log = vi.fn();
  const lock = vi.fn();
  const findProduct = vi.fn();
  const catalog = vi.fn();
  const product = {
    id: 'prod-1',
    farmId: identity.farmId,
    nome: 'Diesel',
    categoria: 'Combustível',
    unidadeMedida: 'L',
    estoqueMinimo: 0,
    precoAquisicao: null,
    validade: null,
    lote: null,
    fornecedor: null,
    updatedAt: new Date(),
  };
  let service: SyncService;
  let mockStockService: any;
  beforeEach(() => {

    vi.resetAllMocks();
    lock.mockResolvedValue([{ id: identity.farmId }]);
    findProduct.mockResolvedValue(product);
    catalog.mockResolvedValue([product]);
    create.mockImplementation(async ({ data }) => ({
      ...data,
      updatedAt: new Date('2026-10-01T12:00:00Z'),
    }));
    const tx = {
      $queryRawUnsafe: lock,
      product: { findFirst: findProduct },
      stockMovement: { findUnique: vi.fn().mockResolvedValue(null), create },
      syncReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: receipt,
      },
      syncLog: { create: log },
    };
    const prisma = {
      farm: { update },
      $transaction: vi.fn(async (work) =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
      ),
      product: { findMany: catalog },
      stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
    };
    mockStockService = {
      reanalyzeAndPersistAlerts: vi.fn().mockResolvedValue({}),
    };
    service = new SyncService(prisma as never, mockStockService as never);
  });

  it('no longer offers a local IP heartbeat (tarefa 5.7-B)', () => {
    expect('updateHeartbeat' in service).toBe(false);
  });
  it('creates an immutable movement and its individual receipt using verified authorship', async () => {
    const item = {
      id: 'm-1',
      farmId: identity.farmId,
      productId: product.id,
      tipo: 'SAIDA' as const,
      quantidade: 5,
      dataMovimento: '2026-10-01T12:00:00Z',
      responsavel: 'forged',
    };
    const result = await service.syncData(
      { farmId: identity.farmId, pendingMovements: [item] },
      identity,
    );
    expect(lock).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      identity.farmId,
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: item.id,
        quantidade: 5,
        responsavel: identity.nome,
      }),
    });
    expect(receipt).toHaveBeenCalledWith({
      data: expect.objectContaining({
        movementId: item.id,
        actorId: identity.actorId,
        result: expect.objectContaining({ status: 'ACCEPTED' }),
      }),
    });
    expect(result.syncedCount).toBe(1);
    expect(result.results[0].id).toBe(item.id);
    expect(result.protocolVersion).toBe(2);
    expect(mockStockService.reanalyzeAndPersistAlerts).toHaveBeenCalledWith(identity.farmId);
  });

  it('logs a failed reanalysis without failing the sync (tarefa 12.11)', async () => {
    const failure = new Error('banco indisponível');
    mockStockService.reanalyzeAndPersistAlerts.mockRejectedValue(failure);
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const item = {
      id: 'm-2',
      farmId: identity.farmId,
      productId: product.id,
      tipo: 'SAIDA' as const,
      quantidade: 1,
      dataMovimento: '2026-10-01T12:00:00Z',
      responsavel: 'Ana',
    };

    const result = await service.syncData({ farmId: identity.farmId, pendingMovements: [item] }, identity);

    expect(result.syncedCount).toBe(1);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(`Falha na reanálise dos alertas da fazenda ${identity.farmId}: banco indisponível`),
      failure.stack,
    );
    logError.mockRestore();
  });

  it('does not log anything when there is nothing to reanalyze', async () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await service.syncData({ farmId: identity.farmId, pendingMovements: [] }, identity);
    expect(mockStockService.reanalyzeAndPersistAlerts).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    logError.mockRestore();
  });

  it('só aceita movimentação de insumo não excluído; desativado ainda recebe o fato', async () => {
    const item = {
      id: 'm-3',
      farmId: identity.farmId,
      productId: product.id,
      tipo: 'SAIDA' as const,
      quantidade: 1,
      dataMovimento: '2026-10-01T12:00:00Z',
      responsavel: 'Ana',
    };
    await service.syncData(
      { farmId: identity.farmId, pendingMovements: [item] },
      identity,
    );
    expect(findProduct).toHaveBeenCalledWith({
      where: {
        id: product.id,
        farmId: identity.farmId,
        excluidoEm: null,
      },
    });
  });

  it('leva ativo e excluidoEm do catálogo aos celulares', async () => {
    const excluidoEm = new Date('2026-10-29T18:00:00Z');
    catalog.mockResolvedValue([
      { ...product, ativo: false, excluidoEm: null },
      { ...product, id: 'prod-2', ativo: true, excluidoEm },
    ]);
    const result = await service.syncData(
      { farmId: identity.farmId, pendingMovements: [] },
      identity,
    );
    expect(result.newProducts).toEqual([
      expect.objectContaining({ id: 'prod-1', ativo: false, excluidoEm: null }),
      expect.objectContaining({
        id: 'prod-2',
        ativo: true,
        excluidoEm: '2026-10-29T18:00:00.000Z',
      }),
    ]);
  });

  it('downloads the full catalog for an empty batch even if a legacy timestamp is supplied', async () => {
    const result = await service.syncData(
      {
        farmId: identity.farmId,
        pendingMovements: [],
        lastSyncTimestamp: '2099-01-01T00:00:00Z',
      },
      identity,
    );
    expect(result.newProducts).toHaveLength(1);
    expect(result.newMovements).toEqual([]);
    expect(result.results).toEqual([]);
    expect(result.syncedCount).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
  });
  it('rejects absent identity, forged device, unsupported protocol and oversized batches before database writes', async () => {
    const body = { farmId: identity.farmId };
    await expect(service.syncData(body, undefined as never)).rejects.toThrow();
    await expect(
      service.syncData({ ...body, deviceId: 'forged' }, identity),
    ).rejects.toThrow();
    await expect(
      service.syncData({ ...body, protocolVersion: 3 } as never, identity),
    ).rejects.toThrow();
    await expect(
      service.syncData(
        { ...body, pendingMovements: Array(101).fill({}) },
        identity,
      ),
    ).rejects.toThrow();
    expect(lock).not.toHaveBeenCalled();
    expect(receipt).not.toHaveBeenCalled();
  });
});
