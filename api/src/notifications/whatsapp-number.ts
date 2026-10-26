import { BadRequestException } from '@nestjs/common';

const FORMAT_HINT =
  'Informe o WhatsApp com o código do país, por exemplo +5569999999999.';

// Aceita espaços, hífens, pontos e parênteses ao digitar; devolve +<dígitos>
// (E.164, 8 a 15 dígitos). Vazio vira null, que significa "sem número".
export function normalizeWhatsappNumber(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new BadRequestException(FORMAT_HINT);
  const compact = raw.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(compact))
    throw new BadRequestException(FORMAT_HINT);
  return compact;
}
