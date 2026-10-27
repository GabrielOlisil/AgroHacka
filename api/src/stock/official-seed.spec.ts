import { describe, expect, it } from 'vitest';
import { getOfficialSeedDataset, validateOfficialDataset } from './official-seed.data';
import {
  calculateRunoutTime,
  checkExpiryRisk,
  detectConsumptionAnomalies,
  calculateAbcCurve,
} from '../stock-engine/stock-engine';

describe('Carga da Base Oficial do AgroHack (Tarefa 6.1)', () => {
  const dataset = getOfficialSeedDataset();

  it('deve conter estrutura válida de fazenda e gestor oficial', () => {
    expect(dataset.farm.nome).toContain('AgroHack');
    expect(dataset.gestor.email).toBe('gestor@agrohack.com');
    expect(dataset.gestor.role).toBe('GESTOR');
    expect(dataset.gestor.telefone).toBeDefined();
    expect(dataset.gestor.telefone).toMatch(/^\+55\d{10,11}$/);
  });

  it('deve conter pelo menos 2 dispositivos de operadores com códigos de pareamento rápidos', () => {
    expect(dataset.devices.length).toBeGreaterThanOrEqual(2);
    const codes = dataset.devices.map((d) => d.pairingCode);
    expect(new Set(codes).size).toBe(dataset.devices.length);
    expect(codes).toContain('AGRO-01');
    expect(codes).toContain('AGRO-02');
  });

  it('deve se identificar como base simulada enquanto a base oficial não for comprovada', () => {
    expect(dataset.origem.tipo).toBe('SIMULADO');
    expect(dataset.origem.descricao).toMatch(/simulad/i);
  });

  it('deve cobrir as 8 categorias do Anexo III do regulamento', () => {
    const categoriasObrigatorias = [
      'Fertilizantes',
      'Defensivos e biológicos',
      'Combustíveis e lubrificantes',
      'Corretivos',
      'Sementes',
      'Peças e manutenção',
      'Materiais de Irrigação',
      'EPI e materiais diversos',
    ];

    const categoriasNaBase = dataset.products.map((p) => p.categoria);
    for (const cat of categoriasObrigatorias) {
      expect(categoriasNaBase).toContain(cat);
    }
  });

  it('Cenário 1 (Risco de Falta): Ureia deve atingir status CRÍTICO de Runout Time (< 5 dias)', () => {
    const ureia = dataset.products.find((p) => p.nome.includes('Ureia'))!;
    const ureiaMovements = dataset.movements.filter((m) => m.productRef === ureia.ref);

    const saldo = ureiaMovements.reduce((acc, m) => (m.tipo === 'ENTRADA' ? acc + m.quantidade : acc - m.quantidade), 0);
    expect(saldo).toBe(15); // saldo restante de 15 sacos

    const saídas = ureiaMovements
      .filter((m) => m.tipo === 'SAIDA')
      .map((m) => ({ data: m.dataMovimento, quantidade: m.quantidade }));

    const runout = calculateRunoutTime(saldo, ureia.estoqueMinimo, saídas);
    expect(runout.status).toBe('CRITICO');
    expect(runout.diasRestantes).not.toBeNull();
    expect(runout.diasRestantes!).toBeLessThanOrEqual(5);
  });

  it('Cenário 2 (Risco de Vencimento): Trichoderma deve disparar risco antes do consumo total', () => {
    const trichoderma = dataset.products.find((p) => p.nome.includes('Trichoderma'))!;
    const movements = dataset.movements.filter((m) => m.productRef === trichoderma.ref);

    const saldo = movements.reduce((acc, m) => (m.tipo === 'ENTRADA' ? acc + m.quantidade : acc - m.quantidade), 0);
    const saídas = movements
      .filter((m) => m.tipo === 'SAIDA')
      .map((m) => ({ data: m.dataMovimento, quantidade: m.quantidade }));

    const runout = calculateRunoutTime(saldo, trichoderma.estoqueMinimo, saídas);
    const expiry = checkExpiryRisk(saldo, runout.consumoMedioDiario, trichoderma.validade!);
    expect(expiry.temRisco).toBe(true);
    expect(expiry.sobraEstimada).toBeGreaterThan(0);
  });

  it('Cenário 3 (Anomalia de Consumo): Diesel S10 deve detectar pico desproporcional de 950L', () => {
    const diesel = dataset.products.find((p) => p.nome.includes('Diesel'))!;
    const dieselMovements = dataset.movements.filter((m) => m.productRef === diesel.ref && m.tipo === 'SAIDA');

    const historico = dieselMovements.slice(0, -1).map((m) => m.quantidade);
    const ultimaRetirada = dieselMovements[dieselMovements.length - 1].quantidade;

    expect(ultimaRetirada).toBe(950);
    const anomaly = detectConsumptionAnomalies(ultimaRetirada, historico);
    expect(anomaly.isAnomaly).toBe(true);
  });

  it('Cenário 4 (Curva ABC): Adubo Fosfatado MAP deve ser classificado como Classe A (maior imobilização)', () => {
    const produtosComSaldo = dataset.products.map((p) => {
      const movs = dataset.movements.filter((m) => m.productRef === p.ref);
      const saldo = movs.reduce((acc, m) => (m.tipo === 'ENTRADA' ? acc + m.quantidade : acc - m.quantidade), 0);
      return {
        id: p.ref,
        nome: p.nome,
        saldo,
        preco: p.precoAquisicao ?? 0,
      };
    });

    const abc = calculateAbcCurve(produtosComSaldo);
    const mapItem = abc.produtos.find((item) => item.nome.includes('MAP'))!;
    expect(mapItem).toBeDefined();
    expect(mapItem.classe).toBe('A');
    expect(mapItem.valorTotal).toBeGreaterThan(100000); // R$ 147.000,00 imobilizados
  });

  it('deve validar integridade de referências em todas as movimentações do dataset', () => {
    const validation = validateOfficialDataset(dataset);
    expect(validation.valido).toBe(true);
    expect(validation.erros).toHaveLength(0);
  });
});
