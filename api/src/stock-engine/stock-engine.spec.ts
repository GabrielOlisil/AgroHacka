import { describe, it, expect } from 'vitest';
import { analyzeStockInventory } from './stock-engine';

describe('StockEngine - Motor Híbrido de Inteligência de Estoque', () => {
  describe('analyzeStockInventory (Motor Integrado com Paridade Total)', () => {
    it('deve realizar análise integrada de produtos e movimentos com paridade ao desktop', () => {
      const now = new Date('2026-10-16T12:00:00Z');
      const products = [
        {
          id: 'p1',
          farmId: 'f1',
          nome: 'Diesel S10',
          categoria: 'Combustível',
          unidadeMedida: 'L',
          estoqueMinimo: 10,
          precoAquisicao: 6,
          validade: null,
        },
      ];
      const movements = [
        {
          id: 'm1',
          farmId: 'f1',
          productId: 'p1',
          tipo: 'ENTRADA' as const,
          quantidade: 100,
          dataMovimento: '2026-10-01T12:00:00Z',
          responsavel: 'Ana',
        },
        {
          id: 'm2',
          farmId: 'f1',
          productId: 'p1',
          tipo: 'SAIDA' as const,
          quantidade: 10,
          dataMovimento: '2026-10-07T12:00:00Z',
          responsavel: 'Carlos',
        },
        {
          id: 'm3',
          farmId: 'f1',
          productId: 'p1',
          tipo: 'SAIDA' as const,
          quantidade: 10,
          dataMovimento: '2026-10-16T10:00:00Z',
          responsavel: 'Carlos',
        },
      ];

      const result = analyzeStockInventory(products, movements, now);

      expect(result.products[0]).toMatchObject({
        saldo: 80,
        consumoMedioDiario: 2,
        diasRestantes: 40,
        valorEstoque: 480,
        classeAbc: 'A', // 100% do valor do estoque concentra-se no produto
      });
      expect(result.totalValue).toBe(480);
      expect(result.balancesByUnit['L']).toBe(80);
    });
  });
});

