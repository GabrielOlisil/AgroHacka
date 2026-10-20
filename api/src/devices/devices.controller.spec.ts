import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  let devicesController: DevicesController;
  let devicesService: any;
  const identity = { role: 'GESTOR', farmId: 'farm-1' };
  let auth: any;

  beforeEach(() => {
    devicesService = {
      createPairingToken: vi.fn(),
      connectDevice: vi.fn(),
    };
    auth = { authenticateSync: vi.fn().mockResolvedValue(identity) };
    devicesController = new DevicesController(
      devicesService as DevicesService,
      auth,
    );
  });

  it('deve chamar createPairingToken com os parâmetros corretos', async () => {
    const dto = { farmId: 'farm-1', nomeOperador: 'Carlos' };
    const mockRes = { pairingCode: 'AGRO-42', deviceToken: 'tok_1' };
    devicesService.createPairingToken.mockResolvedValue(mockRes);

    const result = await devicesController.createPairing(dto, 'Bearer signed');
    expect(auth.authenticateSync).toHaveBeenCalledWith('Bearer signed');
    expect(devicesService.createPairingToken).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockRes);
  });
  it('does not issue device credentials to operators or another farm', async () => {
    auth.authenticateSync.mockResolvedValueOnce({
      role: 'OPERADOR',
      farmId: 'farm-1',
    });
    await expect(
      devicesController.createPairing({ farmId: 'farm-1', nomeOperador: 'X' }),
    ).rejects.toThrow();
    await expect(
      devicesController.createPairing({ farmId: 'other', nomeOperador: 'X' }),
    ).rejects.toThrow();
    expect(devicesService.createPairingToken).not.toHaveBeenCalled();
  });

  it('deve chamar connectDevice com o token ou código', async () => {
    const dto = { tokenOrCode: 'AGRO-42' };
    const mockRes = { sucesso: true, nomeOperador: 'Carlos' };
    devicesService.connectDevice.mockResolvedValue(mockRes);

    const result = await devicesController.connect(dto);
    expect(devicesService.connectDevice).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockRes);
  });
});
