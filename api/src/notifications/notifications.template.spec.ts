import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Valores com formato válido; nenhuma chamada de rede é feita.
const SID = `AC${'0'.repeat(32)}`;
const CONTENT_SID = `HX${'b'.repeat(32)}`;
const keys = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE',
  'TWILIO_CONTENT_SID',
  'TWILIO_CONTENT_VARIABLES',
] as const;

describe('NotificationsService: modelo de conteúdo da Twilio (conta trial)', () => {
  const saved: Partial<Record<(typeof keys)[number], string>> = {};
  let warn: ReturnType<typeof vi.spyOn>;
  let create: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.TWILIO_ACCOUNT_SID = SID;
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE = '+17372508034';
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    create = vi.fn().mockResolvedValue({ sid: 'SM_1', status: 'queued' });
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.restoreAllMocks();
  });

  async function send() {
    const service = new NotificationsService({} as never) as any;
    service.twilioClient = { messages: { create } };
    const result = await service.sendWhatsAppMessage({
      paraTelefone: '+5569999999999',
      mensagem: 'texto do alerta',
    });
    return { result, params: create.mock.calls[0]?.[0] };
  }

  it('com TWILIO_CONTENT_SID envia o modelo no lugar do texto livre', async () => {
    process.env.TWILIO_CONTENT_SID = CONTENT_SID;

    const { result, params } = await send();

    expect(params).toEqual({
      from: 'whatsapp:+17372508034',
      to: 'whatsapp:+5569999999999',
      contentSid: CONTENT_SID,
    });
    expect(params).not.toHaveProperty('body');
    expect(result.sucesso).toBe(true);
  });

  it('repassa TWILIO_CONTENT_VARIABLES ao modelo, exatamente como configurado', async () => {
    process.env.TWILIO_CONTENT_SID = CONTENT_SID;
    process.env.TWILIO_CONTENT_VARIABLES = ' {"1":"12/1","2":"3pm"} ';

    const { params } = await send();

    expect(params.contentVariables).toBe('{"1":"12/1","2":"3pm"}');
  });

  it.each(['{oops', '[]', '"texto"', '42', 'null'])(
    'ignora TWILIO_CONTENT_VARIABLES que não é um objeto JSON (%s) e avisa',
    async (invalid) => {
      process.env.TWILIO_CONTENT_SID = CONTENT_SID;
      process.env.TWILIO_CONTENT_VARIABLES = invalid;

      const { params } = await send();

      expect(params).not.toHaveProperty('contentVariables');
      expect(params.contentSid).toBe(CONTENT_SID);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/TWILIO_CONTENT_VARIABLES/),
      );
    },
  );

  it.each(['abc', 'HX123', `AC${'b'.repeat(32)}`])(
    'ignora TWILIO_CONTENT_SID com formato inválido (%s), avisa e usa o texto livre',
    async (invalid) => {
      process.env.TWILIO_CONTENT_SID = invalid;

      const { params } = await send();

      expect(params).not.toHaveProperty('contentSid');
      expect(params.body).toBe('texto do alerta');
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/TWILIO_CONTENT_SID/));
    },
  );

  it.each([undefined, '', '   '])(
    'sem TWILIO_CONTENT_SID (%j) continua enviando o texto livre, sem aviso',
    async (vazio) => {
      if (vazio !== undefined) process.env.TWILIO_CONTENT_SID = vazio;

      const { params } = await send();

      expect(params).toEqual({
        from: 'whatsapp:+17372508034',
        to: 'whatsapp:+5569999999999',
        body: 'texto do alerta',
      });
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it('variáveis sem modelo não têm efeito: o texto livre segue sem contentVariables', async () => {
    process.env.TWILIO_CONTENT_VARIABLES = '{"1":"x"}';

    const { params } = await send();

    expect(params).not.toHaveProperty('contentVariables');
    expect(params.body).toBe('texto do alerta');
  });
});
