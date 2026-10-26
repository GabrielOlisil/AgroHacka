import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthService } from '../auth/auth.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: {
    sendTestMessage: ReturnType<typeof vi.fn>;
    dispatchCriticalAlerts: ReturnType<typeof vi.fn>;
  };
  let auth: { authenticateSync: ReturnType<typeof vi.fn> };
  const manager = { actorId: 'u1', farmId: 'farm-1', role: 'GESTOR' };
  const operator = { actorId: 'd1', farmId: 'farm-1', role: 'OPERADOR' };

  beforeEach(() => {
    notificationsService = {
      sendTestMessage: vi.fn(),
      dispatchCriticalAlerts: vi.fn(),
    };
    auth = { authenticateSync: vi.fn().mockResolvedValue(manager) };
    controller = new NotificationsController(
      notificationsService as unknown as NotificationsService,
      auth as unknown as AuthService,
    );
  });

  describe('POST /notifications/test-whatsapp', () => {
    it('autentica o gestor e envia o teste da fazenda dele', async () => {
      const response = { sucesso: true, messageSid: 'SM_1' };
      notificationsService.sendTestMessage.mockResolvedValue(response);

      const result = await controller.sendTest(
        { paraTelefone: '+5569999999999', mensagem: 'Teste de Pitch' },
        'Bearer gestor',
      );

      expect(auth.authenticateSync).toHaveBeenCalledWith('Bearer gestor');
      expect(notificationsService.sendTestMessage).toHaveBeenCalledWith({
        farmId: 'farm-1',
        paraTelefone: '+5569999999999',
        mensagem: 'Teste de Pitch',
      });
      expect(result).toEqual(response);
    });

    it('usa uma mensagem padrão quando nenhuma é informada', async () => {
      await controller.sendTest(
        { paraTelefone: '+5569999999999' },
        'Bearer gestor',
      );

      const [call] = notificationsService.sendTestMessage.mock.calls[0] as [
        { mensagem: string },
      ];
      expect(call.mensagem).toContain('Teste de Notificação WhatsApp');
    });

    it('recusa operador sem enviar nada', async () => {
      auth.authenticateSync.mockResolvedValue(operator);

      await expect(
        controller.sendTest({ paraTelefone: '+5569999999999' }, 'Bearer x'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(notificationsService.sendTestMessage).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'Bearer invalido'])(
      'propaga 401 quando a credencial é ausente ou inválida (%s)',
      async (authorization) => {
        auth.authenticateSync.mockRejectedValue(new UnauthorizedException());

        await expect(
          controller.sendTest(
            { paraTelefone: '+5569999999999' },
            authorization as string | undefined,
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(notificationsService.sendTestMessage).not.toHaveBeenCalled();
      },
    );
  });

  describe('POST /notifications/dispatch-critical', () => {
    it('autentica o gestor e dispara os alertas da fazenda dele', async () => {
      notificationsService.dispatchCriticalAlerts.mockResolvedValue({
        totalEnviados: 2,
      });

      const result = await controller.dispatch(
        { farmId: 'farm-1' },
        'Bearer gestor',
      );

      expect(auth.authenticateSync).toHaveBeenCalledWith('Bearer gestor');
      expect(
        notificationsService.dispatchCriticalAlerts,
      ).toHaveBeenCalledWith('farm-1');
      expect(result).toEqual({ totalEnviados: 2 });
    });

    it('recusa pedido para outra fazenda sem disparar nada', async () => {
      await expect(
        controller.dispatch({ farmId: 'farm-de-outro' }, 'Bearer gestor'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        notificationsService.dispatchCriticalAlerts,
      ).not.toHaveBeenCalled();
    });

    it('recusa operador sem disparar nada', async () => {
      auth.authenticateSync.mockResolvedValue(operator);

      await expect(
        controller.dispatch({ farmId: 'farm-1' }, 'Bearer x'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        notificationsService.dispatchCriticalAlerts,
      ).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'Bearer invalido'])(
      'propaga 401 quando a credencial é ausente ou inválida (%s)',
      async (authorization) => {
        auth.authenticateSync.mockRejectedValue(new UnauthorizedException());

        await expect(
          controller.dispatch(
            { farmId: 'farm-1' },
            authorization as string | undefined,
          ),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(
          notificationsService.dispatchCriticalAlerts,
        ).not.toHaveBeenCalled();
      },
    );
  });
});
