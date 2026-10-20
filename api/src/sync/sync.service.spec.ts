import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';
import type { SyncIdentity } from '../auth/auth.service';

const identity: SyncIdentity = {
  actorId: 'user-1',
  farmId: 'farm-1',
  role: 'GESTOR',
  nome: 'Ana',
};
describe('SyncService - authenticated sync and heartbeat', () => {
  const update = vi.fn();
  const create = vi.fn();
  const receipt = vi.fn();
  const log = vi.fn();
  const lock = vi.fn();
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
  beforeEach(() => {
    vi.resetAllMocks();
    lock.mockResolvedValue([{ id: identity.farmId }]);
    create.mockImplementation(async ({ data }) => ({
      ...data,
      updatedAt: new Date('2026-10-01T12:00:00Z'),
    }));
    const tx = {
      $queryRawUnsafe: lock,
      product: { findFirst: vi.fn().mockResolvedValue(product) },
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
      product: { findMany: vi.fn().mockResolvedValue([product]) },
      stockMovement: { findMany: vi.fn().mockResolvedValue([]) },
    };
    service = new SyncService(prisma as never);
  });
  it('updates heartbeat only for the authenticated manager farm', async () => {
    update.mockResolvedValue({
      id: identity.farmId,
      localIp: '192.168.1.55',
      localPort: 3333,
    });
    const result = await service.updateHeartbeat(
      { farmId: identity.farmId, localIp: '192.168.1.55' },
      identity,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: identity.farmId },
      data: { localIp: '192.168.1.55', localPort: 3333 },
    });
    expect(result.sucesso).toBe(true);
    await expect(
      service.updateHeartbeat(
        { farmId: 'foreign', localIp: '127.0.0.1' },
        identity,
      ),
    ).rejects.toThrow();
    await expect(
      service.updateHeartbeat(
        { farmId: identity.farmId, localIp: '127.0.0.1' },
        { ...identity, role: 'OPERADOR' },
      ),
    ).rejects.toThrow();
    expect(update).toHaveBeenCalledOnce();
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
