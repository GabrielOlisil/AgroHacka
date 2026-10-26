import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf-8');
const example = read('../../.env.example');
const service = read('./notifications.service.ts');

const declared = (text: string, pattern: RegExp) =>
  [...new Set([...text.matchAll(pattern)].map((m) => m[1]))].sort();

describe('.env.example da API: variáveis da Twilio', () => {
  it('lista exatamente as variáveis TWILIO_ que o NotificationsService lê', () => {
    const readByCode = declared(service, /process\.env\.(TWILIO_\w+)/g);
    const inExample = declared(example, /^\s*(TWILIO_\w+)\s*=/gm);

    expect(readByCode.length).toBeGreaterThan(0);
    expect(inExample).toEqual(readByCode);
  });

  it('não sugere TWILIO_FROM_NUMBER, que o código ignora', () => {
    expect(example).not.toMatch(/TWILIO_FROM_NUMBER/);
  });

  it('explica que TWILIO_PHONE é opcional e assume o número do Sandbox', () => {
    expect(example).toMatch(/TWILIO_PHONE/);
    expect(example).toMatch(/\+?1\s?415\s?523\s?8886|\+14155238886/);
  });
});
