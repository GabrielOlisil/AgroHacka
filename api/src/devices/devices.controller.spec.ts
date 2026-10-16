import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  let devicesController: DevicesController;
  let devicesService: any;

  beforeEach(() => {
    devicesService = {
      createPairingToken: vi.fn(),
      connectDevice: vi.fn(),
    };
    devicesController = new DevicesController(devicesService as DevicesService);
  });

  it('deve chamar createPairingToken com os parâmetros corretos', async () => {
    const dto = { farmId: 'farm-1', nomeOperador: 'Carlos' };
    const mockRes = { pairingCode: 'AGRO-42', deviceToken: 'tok_1' };
    devicesService.createPairingToken.mockResolvedValue(mockRes);

    const result = await devicesController.createPairing(dto);
    expect(devicesService.createPairingToken).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockRes);
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
