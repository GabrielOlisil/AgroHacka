import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService - Twilio WhatsApp', () => {
  let notificationsService: NotificationsService;
  let prismaService: any;
  let mockTwilioClient: any;

  beforeEach(() => {
    prismaService = {
      alert: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      farm: {
        findUnique: vi.fn(),
      },
    };

    mockTwilioClient = {
      messages: {
        create: vi.fn(),
      },
    };

    notificationsService = new NotificationsService(prismaService as PrismaService);
    // Injeta mock do cliente twilio internamente
    (notificationsService as any).twilioClient = mockTwilioClient;
  });

  describe('sendWhatsAppMessage', () => {
    it('deve enviar mensagem formatada via WhatsApp adicionando prefixo whatsapp:', async () => {
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'SM_mock_123',
        status: 'queued',
      });

      const result = await notificationsService.sendWhatsAppMessage({
        paraTelefone: '+5569999999999',
        mensagem: '⚠️ Alerta de Teste AgroHack',
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'whatsapp:+5569999999999',
          body: '⚠️ Alerta de Teste AgroHack',
        }),
      );

      expect(result.sucesso).toBe(true);
      expect(result.messageSid).toBe('SM_mock_123');
    });

    it('deve simular envio caso as credenciais da Twilio não estejam configuradas', async () => {
      (notificationsService as any).twilioClient = null;

      const result = await notificationsService.sendWhatsAppMessage({
        paraTelefone: '+5569999999999',
        mensagem: '⚠️ Alerta em modo simulação',
      });

      expect(result.sucesso).toBe(true);
      expect(result.modo).toBe('SIMULADO');
    });
  });

  describe('dispatchCriticalAlerts', () => {
    it('deve buscar alertas críticos não notificados do gestor e disparar mensagens WhatsApp', async () => {
      const farmId = 'farm-1';
      const mockGestor = {
        id: 'u1',
        nome: 'José Produtor',
        telefone: '+5569999999999',
      };

      const mockAlerts = [
        {
          id: 'alt-1',
          farmId,
          nivelUrgencia: 'ALTA',
          justificativa: 'Ureia acaba em 2 dias',
          notificadoWhatsapp: false,
          product: { nome: 'Ureia 46%' },
        },
      ];

      prismaService.user.findFirst.mockResolvedValue(mockGestor);
      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.update.mockResolvedValue({ id: 'alt-1', notificadoWhatsapp: true });

      mockTwilioClient.messages.create.mockResolvedValue({ sid: 'SM_alert_1' });

      const result = await notificationsService.dispatchCriticalAlerts(farmId);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          nivelUrgencia: 'ALTA',
          notificadoWhatsapp: false,
        },
        include: { product: true },
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { id: 'alt-1' },
        data: { notificadoWhatsapp: true },
      });

      expect(result.totalEnviados).toBe(1);
    });

    it('não deve disparar se o gestor não possuir telefone cadastrado', async () => {
      prismaService.user.findFirst.mockResolvedValue({ id: 'u1', telefone: null });

      const result = await notificationsService.dispatchCriticalAlerts('farm-1');
      expect(result.totalEnviados).toBe(0);
      expect(result.motivo).toContain('sem telefone cadastrado');
    });
  });
});
