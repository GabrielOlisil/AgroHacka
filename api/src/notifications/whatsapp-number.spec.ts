import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { normalizeWhatsappNumber } from './whatsapp-number';

describe('normalizeWhatsappNumber', () => {
  it.each([
    ['+5569999999999', '+5569999999999'],
    ['+55 69 99999-9999', '+5569999999999'],
    ['+55 (69) 99999-9999', '+5569999999999'],
    ['  +55.69.99999.9999  ', '+5569999999999'],
    ['+1 415 523 8886', '+14155238886'],
  ])('normaliza %s para o formato canônico', (digitado, esperado) => {
    expect(normalizeWhatsappNumber(digitado)).toBe(esperado);
  });

  it.each([undefined, null, '', '   ', ' - ( ) . '])(
    'trata ausência ou texto sem número (%j) como "sem número"',
    (vazio) => {
      expect(normalizeWhatsappNumber(vazio)).toBeNull();
    },
  );

  it('aceita o menor e o maior tamanho válidos (8 a 15 dígitos)', () => {
    expect(normalizeWhatsappNumber('+12345678')).toBe('+12345678');
    expect(normalizeWhatsappNumber('+123456789012345')).toBe('+123456789012345');
  });

  it.each([
    'abc',
    '5569999999999',
    '69999999999',
    '+0123456789012',
    '+55 69',
    '+1234567',
    '+1234567890123456',
    '++5569999999999',
    '+55 69 9999x-9999',
    '+55 69 99999-9999 ramal 2',
    'whatsapp:+5569999999999',
  ])('rejeita número inválido (%s) pedindo o código do país', (invalido) => {
    expect(() => normalizeWhatsappNumber(invalido)).toThrow(BadRequestException);
    expect(() => normalizeWhatsappNumber(invalido)).toThrow(/código do país/);
  });

  it.each([123, true, {}, []])('rejeita valor que não é texto (%j)', (valor) => {
    expect(() => normalizeWhatsappNumber(valor)).toThrow(BadRequestException);
  });
});
