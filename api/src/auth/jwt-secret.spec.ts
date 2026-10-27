import { describe, expect, it } from 'vitest';
import { DEV_JWT_SECRET, resolveJwtSecret } from './jwt-secret';

describe('resolveJwtSecret (tarefa 10.2)', () => {
  it('usa o JWT_SECRET definido', () => {
    expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'um-segredo-forte-e-privado' })).toBe(
      'um-segredo-forte-e-privado',
    );
    expect(resolveJwtSecret({ JWT_SECRET: 'local' })).toBe('local');
  });

  it('fora de produção, sem JWT_SECRET, usa o segredo de desenvolvimento', () => {
    expect(resolveJwtSecret({})).toBe(DEV_JWT_SECRET);
    expect(resolveJwtSecret({ NODE_ENV: 'development', JWT_SECRET: '' })).toBe(DEV_JWT_SECRET);
    expect(resolveJwtSecret({ NODE_ENV: 'test', JWT_SECRET: '   ' })).toBe(DEV_JWT_SECRET);
  });

  it('em produção, recusa JWT_SECRET ausente, vazio ou em branco', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: '  ' })).toThrow(/JWT_SECRET/);
  });

  it('em produção, recusa o segredo público de desenvolvimento', () => {
    expect(() => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: DEV_JWT_SECRET })).toThrow(/público/);
  });
});
