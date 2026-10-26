import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service';

describe('NotificationsService: formato do número enviado à Twilio', () => {
  let service: NotificationsService;
  let prisma: any;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prisma = {
      user: { findFirst: vi.fn() },
      alert: { findMany: vi.fn(), update: vi.fn() },
    };
    service = new NotificationsService(prisma);
    create = vi.fn().mockResolvedValue({ sid: 'SM_1', status: 'queued' });
    (service as any).twilioClient = { messages: { create } };
  });

  it.each([
    ['+55 69 99999-9999', 'whatsapp:+5569999999999'],
    ['+55 (69) 99999-9999', 'whatsapp:+5569999999999'],
    ['whatsapp:+5569999999999', 'whatsapp:+5569999999999'],
  ])('envia %s como %s', async (digitado, esperado) => {
    const result = await service.sendWhatsAppMessage({
      paraTelefone: digitado,
      mensagem: 'oi',
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ to: esperado }));
    expect(result.sucesso).toBe(true);
  });

  it.each(['abc', '', '5569999999999', '+55 69'])(
    'não chama a Twilio com número inválido (%j) e explica o formato',
    async (invalido) => {
      const result = await service.sendWhatsAppMessage({
        paraTelefone: invalido,
        mensagem: 'oi',
      });

      expect(create).not.toHaveBeenCalled();
      expect(result).toMatchObject({ sucesso: false });
      expect((result as { erro: string }).erro).toMatch(/\+5569999999999/);
    },
  );

  it('conserta número antigo salvo com espaços ao disparar alertas críticos', async () => {
    prisma.user.findFirst.mockResolvedValue({
      nome: 'Ana',
      telefone: '+55 69 99999-9999',
    });
    prisma.alert.findMany.mockResolvedValue([
      { id: 'a1', justificativa: 'falta em 3 dias', product: { nome: 'Ureia' } },
    ]);

    const result = await service.dispatchCriticalAlerts('farm-1');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'whatsapp:+5569999999999' }),
    );
    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { notificadoWhatsapp: true },
    });
    expect(result.totalEnviados).toBe(1);
  });

  it('não marca o alerta como notificado quando o número salvo é inválido', async () => {
    prisma.user.findFirst.mockResolvedValue({ nome: 'Ana', telefone: 'abc' });
    prisma.alert.findMany.mockResolvedValue([
      { id: 'a1', justificativa: 'x', product: { nome: 'Ureia' } },
    ]);

    const result = await service.dispatchCriticalAlerts('farm-1');

    expect(create).not.toHaveBeenCalled();
    expect(prisma.alert.update).not.toHaveBeenCalled();
    expect(result.totalEnviados).toBe(0);
  });
});
