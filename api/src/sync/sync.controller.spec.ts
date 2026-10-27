import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

describe('SyncController', () => {
  let syncController: SyncController;
  let syncService: any;
  const identity = {
    actorId: 'user',
    farmId: 'farm-1',
    role: 'GESTOR',
    nome: 'Ana',
  };
  let auth: any;

  beforeEach(() => {
    syncService = {
      syncData: vi.fn(),
    };
    auth = { authenticateSync: vi.fn().mockResolvedValue(identity) };
    syncController = new SyncController(syncService as SyncService, auth);
  });

  it('deve chamar syncData com o payload correto', async () => {
    const payload = {
      farmId: 'farm-1',
      pendingMovements: [],
    };
    const mockRes = { sucesso: true, syncedCount: 0 };
    syncService.syncData.mockResolvedValue(mockRes);

    const result = await syncController.sync(payload, 'Bearer signed');
    expect(auth.authenticateSync).toHaveBeenCalledWith(
      'Bearer signed',
      undefined,
    );
    expect(syncService.syncData).toHaveBeenCalledWith(payload, identity);
    expect(result).toEqual(mockRes);
  });

  it('não expõe mais heartbeat de IP local (tarefa 5.7-B)', () => {
    expect('heartbeat' in syncController).toBe(false);
  });
  it('does not touch storage when authentication fails', async () => {
    auth.authenticateSync.mockRejectedValue(new Error('unauthorized'));
    await expect(syncController.sync({ farmId: 'farm-1' })).rejects.toThrow(
      'unauthorized',
    );
    expect(syncService.syncData).not.toHaveBeenCalled();
  });
});
