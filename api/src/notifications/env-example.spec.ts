import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('.env.example da API: nenhuma variável morta', () => {
  // Variáveis padrão do Node e das bibliotecas, lidas fora do nosso código.
  const runtime = new Set(['NODE_ENV']);
  const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
  const source = [
    ...readdirSync(join(apiRoot, 'src'), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .map((file) => readFileSync(join(apiRoot, 'src', file), 'utf-8')),
    readFileSync(join(apiRoot, 'prisma', 'schema.prisma'), 'utf-8'),
  ].join('\n');

  it('toda variável do exemplo é lida pelo código da API', () => {
    const keys = declared(example, /^\s*([A-Z_][A-Z0-9_]*)\s*=/gm);
    const unused = keys.filter(
      (key) =>
        !runtime.has(key) &&
        !source.includes(`process.env.${key}`) &&
        !source.includes(`env("${key}")`),
    );

    expect(keys.length).toBeGreaterThan(0);
    expect(unused).toEqual([]);
  });

  it('não sugere GESTAO_WHATSAPP: o número do gestor vem do cadastro, não do ambiente', () => {
    expect(example).not.toMatch(/GESTAO_WHATSAPP/);
  });
});
