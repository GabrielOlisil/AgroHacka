import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Account SID com formato válido (AC + 32 caracteres); nenhuma chamada de rede é feita.
const SID = `AC${'0'.repeat(32)}`;
const keys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE'] as const;

describe('NotificationsService: configuração do remetente da Twilio', () => {
  const saved: Partial<Record<(typeof keys)[number], string>> = {};
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  const build = () => new NotificationsService({} as never) as any;

  it('usa o remetente informado em TWILIO_PHONE, normalizado', async () => {
    process.env.TWILIO_ACCOUNT_SID = SID;
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE = '+1 737 250 8034';

    const service = build();
    expect(service.twilioClient).not.toBeNull();

    const create = vi.fn().mockResolvedValue({ sid: 'SM_1', status: 'queued' });
    service.twilioClient = { messages: { create } };
    await service.sendWhatsAppMessage({ paraTelefone: '+556993418565', mensagem: 'oi' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+17372508034',
        to: 'whatsapp:+556993418565',
      }),
    );
  });

  it.each([undefined, '', '   '])(
    'sem TWILIO_PHONE (%j) não inventa remetente: entra em simulação e avisa',
    async (phone) => {
      process.env.TWILIO_ACCOUNT_SID = SID;
      process.env.TWILIO_AUTH_TOKEN = 'token';
      if (phone !== undefined) process.env.TWILIO_PHONE = phone;

      const service = build();

      expect(service.twilioClient).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TWILIO_PHONE/));
      const result = await service.sendWhatsAppMessage({
        paraTelefone: '+556993418565',
        mensagem: 'oi',
      });
      expect(result).toMatchObject({ sucesso: true, modo: 'SIMULADO' });
    },
  );

  it('TWILIO_PHONE inválido também cai em simulação com aviso', () => {
    process.env.TWILIO_ACCOUNT_SID = SID;
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE = 'abc';

    const service = build();

    expect(service.twilioClient).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TWILIO_PHONE/));
  });

  it('nunca usa o número do Sandbox antigo (+14155238886) como padrão', () => {
    process.env.TWILIO_ACCOUNT_SID = SID;
    process.env.TWILIO_AUTH_TOKEN = 'token';

    const service = build();

    expect(service.twilioPhone).not.toBe('+14155238886');
  });

  it('sem credenciais continua em simulação, como antes', () => {
    const service = build();
    expect(service.twilioClient).toBeNull();
  });
});
