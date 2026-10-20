import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

describe('SyncController', () => {
  let syncController: SyncController;
  let syncService: any;

  beforeEach(() => {
    syncService = {
      syncData: vi.fn(),
      updateHeartbeat: vi.fn(),
    };
    syncController = new SyncController(syncService as SyncService);
  });

  it('deve chamar syncData com o payload correto', async () => {
    const payload = {
      farmId: 'farm-1',
      pendingMovements: [],
    };
    const mockRes = { sucesso: true, syncedCount: 0 };
    syncService.syncData.mockResolvedValue(mockRes);

    const result = await syncController.sync(payload);
    expect(syncService.syncData).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockRes);
  });

  it('deve chamar updateHeartbeat com o ip e porta da fazenda', async () => {
    const payload = {
      farmId: 'farm-1',
      localIp: '192.168.1.10',
      localPort: 3333,
    };
    const mockRes = { sucesso: true, localIp: '192.168.1.10' };
    syncService.updateHeartbeat.mockResolvedValue(mockRes);

    const result = await syncController.heartbeat(payload);
    expect(syncService.updateHeartbeat).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockRes);
  });
});
