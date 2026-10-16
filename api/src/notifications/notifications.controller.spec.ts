import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let notificationsController: NotificationsController;
  let notificationsService: any;

  beforeEach(() => {
    notificationsService = {
      sendWhatsAppMessage: vi.fn(),
      dispatchCriticalAlerts: vi.fn(),
    };
    notificationsController = new NotificationsController(notificationsService as NotificationsService);
  });

  it('deve chamar sendWhatsAppMessage para teste manual', async () => {
    const dto = {
      paraTelefone: '+5569999999999',
      mensagem: 'Teste de Pitch',
    };
    const mockRes = { sucesso: true, messageSid: 'SM_1' };
    notificationsService.sendWhatsAppMessage.mockResolvedValue(mockRes);

    const result = await notificationsController.sendTest(dto);
    expect(notificationsService.sendWhatsAppMessage).toHaveBeenCalledWith({
      paraTelefone: '+5569999999999',
      mensagem: 'Teste de Pitch',
    });
    expect(result).toEqual(mockRes);
  });

  it('deve chamar dispatchCriticalAlerts com farmId', async () => {
    const dto = { farmId: 'farm-1' };
    const mockRes = { totalEnviados: 2 };
    notificationsService.dispatchCriticalAlerts.mockResolvedValue(mockRes);

    const result = await notificationsController.dispatch(dto);
    expect(notificationsService.dispatchCriticalAlerts).toHaveBeenCalledWith('farm-1');
    expect(result).toEqual(mockRes);
  });
});
