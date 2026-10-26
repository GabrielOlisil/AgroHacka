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
      updateLocalIp: vi.fn(),
      listOperators: vi.fn(),
    };
    auth = { authenticateSync: vi.fn().mockResolvedValue(identity) };
    devicesController = new DevicesController(
      devicesService as DevicesService,
      auth,
    );
  });

  it('deve chamar updateLocalIp quando autenticado como gestor da fazenda', async () => {
    const dto = { farmId: 'farm-1', localIp: '192.168.1.50', localPort: 3333 };
    const mockRes = { sucesso: true, localIp: '192.168.1.50', localPort: 3333 };
    devicesService.updateLocalIp.mockResolvedValue(mockRes);

    const result = await devicesController.updateLocalIp(dto, 'Bearer signed');
    expect(auth.authenticateSync).toHaveBeenCalledWith('Bearer signed');
    expect(devicesService.updateLocalIp).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockRes);
  });
  it('derives the listing scope from the authenticated manager instead of request data', async () => {
    devicesService.listOperators.mockResolvedValue({
      farmId: 'farm-1',
      operators: [],
    });
    expect(await devicesController.listOperators('Bearer signed')).toEqual({
      farmId: 'farm-1',
      operators: [],
    });
    expect(auth.authenticateSync).toHaveBeenCalledWith('Bearer signed');
    expect(devicesService.listOperators).toHaveBeenCalledWith('farm-1');
  });
  it('does not expose pairing codes to an operator or an unauthenticated request', async () => {
    auth.authenticateSync.mockResolvedValueOnce({
      role: 'OPERADOR',
      farmId: 'farm-1',
    });
    await expect(
      devicesController.listOperators('Bearer operator'),
    ).rejects.toThrow();
    auth.authenticateSync.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(devicesController.listOperators()).rejects.toThrow(
      'Unauthorized',
    );
    expect(devicesService.listOperators).not.toHaveBeenCalled();
  });

  it('deve rejeitar updateLocalIp se usuario for operador ou de outra fazenda', async () => {
    auth.authenticateSync.mockResolvedValueOnce({
      role: 'OPERADOR',
      farmId: 'farm-1',
    });
    await expect(
      devicesController.updateLocalIp(
        { farmId: 'farm-1', localIp: '1.2.3.4' },
        'Bearer token',
      ),
    ).rejects.toThrow();

    auth.authenticateSync.mockResolvedValueOnce({
      role: 'GESTOR',
      farmId: 'outra-fazenda',
    });
    await expect(
      devicesController.updateLocalIp(
        { farmId: 'farm-1', localIp: '1.2.3.4' },
        'Bearer token',
      ),
    ).rejects.toThrow();
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
