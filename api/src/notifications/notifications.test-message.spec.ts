import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.sendTestMessage', () => {
  let service: NotificationsService;
  let prisma: { user: { findFirst: ReturnType<typeof vi.fn> } };
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    prisma = { user: { findFirst: vi.fn() } };
    service = new NotificationsService(prisma as never);
    send = vi
      .spyOn(service, 'sendWhatsAppMessage')
      .mockResolvedValue({ sucesso: true } as never);
  });

  it('envia o teste ao número cadastrado do gestor da própria fazenda', async () => {
    prisma.user.findFirst.mockResolvedValue({ telefone: '+5569999999999' });

    const result = await service.sendTestMessage({
      farmId: 'farm-1',
      paraTelefone: '+5569999999999',
      mensagem: 'Teste de Pitch',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { farmId: 'farm-1', role: 'GESTOR' },
    });
    expect(send).toHaveBeenCalledWith({
      paraTelefone: '+5569999999999',
      mensagem: 'Teste de Pitch',
    });
    expect(result).toEqual({ sucesso: true });
  });

  it.each([
    '+55 (69) 99999-9999',
    '5569999999999',
    '  +55 69 9 9999 9999  ',
  ])('aceita o mesmo número escrito de outra forma: %s', async (digitado) => {
    prisma.user.findFirst.mockResolvedValue({ telefone: '+5569999999999' });

    await service.sendTestMessage({
      farmId: 'farm-1',
      paraTelefone: digitado,
      mensagem: 'm',
    });

    expect(send).toHaveBeenCalledOnce();
  });

  it('recusa um número diferente do cadastrado sem enviar nada nem revelar o número do gestor', async () => {
    prisma.user.findFirst.mockResolvedValue({ telefone: '+5569999999999' });

    const attempt = service.sendTestMessage({
      farmId: 'farm-1',
      paraTelefone: '+5511988887777',
      mensagem: 'm',
    });

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.not.toThrow(/9999999999/);
    expect(send).not.toHaveBeenCalled();
  });

  it('recusa quando o gestor não tem telefone cadastrado', async () => {
    prisma.user.findFirst.mockResolvedValue({ telefone: null });

    await expect(
      service.sendTestMessage({
        farmId: 'farm-1',
        paraTelefone: '+5569999999999',
        mensagem: 'm',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('recusa quando a fazenda não tem gestor', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.sendTestMessage({
        farmId: 'farm-1',
        paraTelefone: '+5569999999999',
        mensagem: 'm',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['', '   ', undefined, null])(
    'recusa número ausente ou em branco (%s) sem consultar o banco',
    async (vazio) => {
      await expect(
        service.sendTestMessage({
          farmId: 'farm-1',
          paraTelefone: vazio as never,
          mensagem: 'm',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('recusa número sem dígitos, como texto qualquer', async () => {
    prisma.user.findFirst.mockResolvedValue({ telefone: '+5569999999999' });

    await expect(
      service.sendTestMessage({
        farmId: 'farm-1',
        paraTelefone: 'abc',
        mensagem: 'm',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
