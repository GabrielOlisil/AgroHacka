import { describe, it, expect } from 'vitest';
import {
  calculateRunoutTime,
  checkExpiryRisk,
  detectConsumptionAnomalies,
  calculateAbcCurve,
  prioritizeAlerts,
  normalizeUnitAndName,
} from './stock-engine';

describe('StockEngine - Motor Híbrido de Inteligência de Estoque', () => {
  describe('normalizeUnitAndName', () => {
    it('deve padronizar nomes de insumos removendo espaços extras e capitalizando corretamente', () => {
      const result = normalizeUnitAndName('  npk  10-10-10  ', 'SC');
      expect(result.nome).toBe('NPK 10-10-10');
      expect(result.unidadeMedida).toBe('sc');
    });

    it('deve lidar com entradas vazias ou nulas sem quebrar', () => {
      const result = normalizeUnitAndName('', '');
      expect(result.nome).toBe('');
      expect(result.unidadeMedida).toBe('un');
    });
  });

  describe('calculateRunoutTime (Risco de Falta e Autonomia)', () => {
    it('deve calcular corretamente a autonomia de estoque com justificativa clara', () => {
      const saldoAtual = 15; // sacas
      const estoqueMinimo = 40;
      // 3 saídas de 5 sacas nos últimos 3 dias = média de 5 sacas/dia
      const saidas = [
        { quantidade: 5, data: new Date('2026-10-13') },
        { quantidade: 5, data: new Date('2026-10-14') },
        { quantidade: 5, data: new Date('2026-10-15') },
      ];

      const result = calculateRunoutTime(saldoAtual, estoqueMinimo, saidas);

      expect(result.diasRestantes).toBe(3);
      expect(result.consumoMedioDiario).toBe(5);
      expect(result.status).toBe('CRITICO');
      expect(result.justificativa).toContain('3 dias');
      expect(result.confiabilidade).toBe('MEDIA'); // 3 amostras
    });

    it('deve tratar caso de borda com histórico vazio (sem consumo)', () => {
      const result = calculateRunoutTime(50, 20, []);

      expect(result.diasRestantes).toBeNull();
      expect(result.consumoMedioDiario).toBe(0);
      expect(result.status).toBe('NORMAL');
      expect(result.justificativa).toContain('Sem histórico de consumo');
      expect(result.confiabilidade).toBe('BAIXA');
    });

    it('deve tratar caso de saldo zerado', () => {
      const saidas = [{ quantidade: 10, data: new Date() }];
      const result = calculateRunoutTime(0, 20, saidas);

      expect(result.diasRestantes).toBe(0);
      expect(result.status).toBe('CRITICO');
      expect(result.justificativa).toContain('Estoque zerado');
    });

    it('deve tratar saldo negativo como zero e alertar urgência máxima', () => {
      const result = calculateRunoutTime(-5, 10, []);
      expect(result.diasRestantes).toBe(0);
      expect(result.status).toBe('CRITICO');
    });
  });

  describe('checkExpiryRisk (Risco de Vencimento vs. Ritmo de Uso)', () => {
    it('deve alertar risco quando o produto for vencer antes do término do estoque', () => {
      const saldoAtual = 40; // 40 litros
      const consumoMedioDiario = 0.2; // consome 1L a cada 5 dias
      const dataValidade = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // vence em 10 dias

      // Em 10 dias consumirá apenas 2 litros (sobrando 38 litros vencidos)
      const result = checkExpiryRisk(saldoAtual, consumoMedioDiario, dataValidade);

      expect(result.temRisco).toBe(true);
      expect(result.diasAteVencimento).toBe(10);
      expect(result.sobraEstimada).toBe(38);
      expect(result.justificativa).toContain('38');
    });

    it('não deve gerar risco quando o produto for consumido muito antes da validade', () => {
      const saldoAtual = 10;
      const consumoMedioDiario = 5; // acaba em 2 dias
      const dataValidade = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // vence em 60 dias

      const result = checkExpiryRisk(saldoAtual, consumoMedioDiario, dataValidade);

      expect(result.temRisco).toBe(false);
      expect(result.sobraEstimada).toBe(0);
    });

    it('deve retornar sem risco se o produto não tiver data de validade', () => {
      const result = checkExpiryRisk(100, 2, null);
      expect(result.temRisco).toBe(false);
      expect(result.diasAteVencimento).toBeNull();
    });

    it('deve alertar imediatamente se o produto já estiver vencido', () => {
      const dataValidadePassada = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // venceu há 2 dias
      const result = checkExpiryRisk(20, 1, dataValidadePassada);

      expect(result.temRisco).toBe(true);
      expect(result.jaVenceu).toBe(true);
      expect(result.justificativa).toContain('vencido');
    });
  });

  describe('detectConsumptionAnomalies (Detecção de Saídas Fora do Padrão)', () => {
    it('deve detectar saída anômala muito superior à média histórica', () => {
      // Histórico diário: 50, 60, 55, 65, 70 (média em torno de 60)
      const historico = [50, 60, 55, 65, 70];
      const saidaAtual = 950; // retirada de 950 litros de diesel

      const result = detectConsumptionAnomalies(saidaAtual, historico);

      expect(result.isAnomaly).toBe(true);
      expect(result.mediaHistorica).toBeCloseTo(60, 0);
      expect(result.multiplicador).toBeGreaterThan(10); // mais de 10x a média
      expect(result.justificativa).toContain('atípica');
    });

    it('não deve marcar anomalia para saída dentro da variação habitual', () => {
      const historico = [50, 60, 55, 65, 70];
      const saidaAtual = 65;

      const result = detectConsumptionAnomalies(saidaAtual, historico);

      expect(result.isAnomaly).toBe(false);
    });

    it('deve tratar histórico com poucas amostras (< 3) sem disparar falsos positivos', () => {
      const historico = [10];
      const saidaAtual = 50;

      const result = detectConsumptionAnomalies(saidaAtual, historico);

      expect(result.isAnomaly).toBe(false);
      expect(result.justificativa).toContain('Amostras insuficientes');
    });
  });

  describe('calculateAbcCurve (Curva ABC & Capital Imobilizado)', () => {
    it('deve classificar produtos em A (80%), B (15%) e C (5%) do valor total', () => {
      const produtos = [
        { id: '1', nome: 'Adubo MAP', saldo: 35, preco: 4200 }, // R$ 147.000 (Classe A)
        { id: '2', nome: 'Ureia', saldo: 100, preco: 160 }, // R$ 16.000 (Classe B)
        { id: '3', nome: 'Bicos Pulv', saldo: 50, preco: 35 }, // R$ 1.750 (Classe C)
        { id: '4', nome: 'Luvas', saldo: 20, preco: 10 }, // R$ 200 (Classe C)
      ];

      const result = calculateAbcCurve(produtos);

      expect(result.totalEstoqueFinanceiro).toBe(164950);
      expect(result.produtos[0].classe).toBe('A');
      expect(result.produtos[0].id).toBe('1');
      expect(result.produtos[1].classe).toBe('B');
      expect(result.produtos[2].classe).toBe('C');
      expect(result.produtos[3].classe).toBe('C');
    });

    it('deve lidar com lista vazia de produtos', () => {
      const result = calculateAbcCurve([]);
      expect(result.totalEstoqueFinanceiro).toBe(0);
      expect(result.produtos).toEqual([]);
    });

    it('deve desconsiderar produtos com preço nulo ou negativo no cálculo financeiro', () => {
      const produtos = [
        { id: '1', nome: 'Item Sem Preço', saldo: 10, preco: null },
        { id: '2', nome: 'Item Com Preço', saldo: 2, preco: 100 },
      ];

      const result = calculateAbcCurve(produtos);
      expect(result.totalEstoqueFinanceiro).toBe(200);
      expect(result.produtos[0].id).toBe('2');
      expect(result.produtos[1].id).toBe('1');
      expect(result.produtos[1].valorTotal).toBe(0);
    });
  });

  describe('prioritizeAlerts (Priorização Inteligente de Alertas)', () => {
    it('deve ordenar alertas colocando URGENTE antes de ATENÇÃO e INFORMATIVO', () => {
      const alertas = [
        { id: 'a1', nivel: 'INFORMATIVO' as const, titulo: 'Nova entrada registrada' },
        { id: 'a2', nivel: 'URGENTE' as const, titulo: 'Ureia acaba em 2 dias' },
        { id: 'a3', nivel: 'ATENCAO' as const, titulo: 'Trichoderma vence em 10 dias' },
      ];

      const result = prioritizeAlerts(alertas);

      expect(result[0].id).toBe('a2');
      expect(result[0].nivel).toBe('URGENTE');
      expect(result[1].id).toBe('a3');
      expect(result[1].nivel).toBe('ATENCAO');
      expect(result[2].id).toBe('a1');
      expect(result[2].nivel).toBe('INFORMATIVO');
    });

    it('deve retornar array vazio se não houver alertas', () => {
      const result = prioritizeAlerts([]);
      expect(result).toEqual([]);
    });
  });
});
