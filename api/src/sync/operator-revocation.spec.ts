import { describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service';

describe('operator access is revalidated inside the farm transaction', () => {
  it.each([null, { id: 'd', ativo: false }])(
    'refuses a deleted/inactive device after authentication %j',
    async (device) => {
      const query = vi.fn().mockResolvedValue([{ id: 'f' }]);
      const find = vi.fn().mockResolvedValue(device?.ativo ? device : null);
      const create = vi.fn();
      const tx = {
        $queryRawUnsafe: query,
        device: { findFirst: find },
        syncLog: { create },
      };
      const service = new SyncService({
        $transaction: async (work: unknown) =>
          typeof work === 'function'
            ? work(tx)
            : Promise.all(work as Promise<unknown>[]),
        product: { findMany: async () => [] },
        stockMovement: { findMany: async () => [] },
      } as never);
      await expect(
        service.syncData(
          { farmId: 'f', pendingMovements: [] },
          {
            farmId: 'f',
            actorId: 'd',
            deviceId: 'd',
            role: 'OPERADOR',
            nome: 'Ana',
          },
        ),
      ).rejects.toMatchObject({ status: 401 });
      expect(find).toHaveBeenCalledWith({
        where: { id: 'd', farmId: 'f', ativo: true },
      });
      expect(query).toHaveBeenCalledBefore(find);
      expect(create).not.toHaveBeenCalled();
    },
  );
});
