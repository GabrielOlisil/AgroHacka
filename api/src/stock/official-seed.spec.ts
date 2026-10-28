import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getOfficialSeedDataset, validateOfficialDataset } from './official-seed.data';
import { analyzeStockInventory } from '../stock-engine/stock-engine';

// The demo dataset builds its dates from "now"; freeze it so the answer key is stable.
const NOW = new Date('2026-10-20T15:00:00.000Z');

describe('Carga da Base Oficial do AgroHack (Tarefa 6.1)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  const dataset = () => getOfficialSeedDataset();

  it('deve conter estrutura válida de fazenda e gestor oficial', () => {
    const { farm, gestor } = dataset();
    expect(farm.nome).toContain('AgroHack');
    expect(farm).not.toHaveProperty('localIp');
    expect(farm).not.toHaveProperty('localPort');
    expect(gestor.email).toBe('gestor@agrohack.com');
    expect(gestor.role).toBe('GESTOR');
    expect(gestor.telefone).toBeDefined();
    expect(gestor.telefone).toMatch(/^\+55\d{10,11}$/);
  });

  it('deve conter pelo menos 2 dispositivos de operadores com códigos de pareamento rápidos', () => {
    const { devices } = dataset();
    expect(devices.length).toBeGreaterThanOrEqual(2);
    const codes = devices.map((d) => d.pairingCode);
    expect(new Set(codes).size).toBe(devices.length);
    expect(codes).toContain('AGRO-01');
    expect(codes).toContain('AGRO-02');
  });

  it('deve se identificar como base simulada enquanto a base oficial não for comprovada', () => {
    const { origem } = dataset();
    expect(origem.tipo).toBe('SIMULADO');
    expect(origem.descricao).toMatch(/simulad/i);
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

    const categoriasNaBase = dataset().products.map((p) => p.categoria);
    for (const cat of categoriasObrigatorias) {
      expect(categoriasNaBase).toContain(cat);
    }
  });

  it('deve validar integridade de referências em todas as movimentações do dataset', () => {
    const validation = validateOfficialDataset(dataset());
    expect(validation.valido).toBe(true);
    expect(validation.erros).toHaveLength(0);
  });
});

// Answer key (tarefa 12.10): the production engine, the same one the API runs,
// must find every planted problem and stay silent on the normal products.
describe('Gabarito da base simulada no motor de produção (Tarefa 12.10)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => vi.useRealTimers());

  const analyze = () => {
    const { products, movements } = getOfficialSeedDataset();
    return analyzeStockInventory(
      products.map((p) => ({
        id: p.ref,
        farmId: 'demo',
        nome: p.nome,
        categoria: p.categoria,
        unidadeMedida: p.unidadeMedida,
        estoqueMinimo: p.estoqueMinimo,
        precoAquisicao: p.precoAquisicao,
        validade: p.validade,
      })),
      movements.map((m, i) => ({
        id: `m${i}`,
        farmId: 'demo',
        productId: m.productRef,
        tipo: m.tipo,
        quantidade: m.quantidade,
        dataMovimento: m.dataMovimento,
      })),
      NOW,
    );
  };

  it('gera exatamente os alertas planejados, na ordem de prioridade', () => {
    expect(analyze().alerts.map((a) => `${a.nivel} ${a.tipo} ${a.productId}`)).toEqual([
      'URGENTE FALTA ureia',
      'ATENCAO ANOMALIA diesel',
      'ATENCAO VENCIMENTO trichoderma',
      'INFORMATIVO EXCESSO trichoderma',
      'INFORMATIVO PARADO bicos',
      'INFORMATIVO PARADO map',
      'INFORMATIVO PARADO respirador',
    ]);
  });

  it('não gera nenhum alerta para os insumos normais', () => {
    const normais = ['calcario', 'semente_milho', 'gotejamento'];
    expect(analyze().alerts.filter((a) => normais.includes(a.productId))).toEqual([]);
  });

  it('Falta: a ureia fica abaixo do mínimo e o alerta mostra a conta', () => {
    const { alerts, products } = analyze();
    expect(products.find((p) => p.id === 'ureia')?.saldo).toBe(15);
    expect(alerts.find((a) => a.id === 'FALTA:ureia')?.justificativa).toContain(
      'Restam 15 sc, no mínimo ou abaixo do mínimo de 40 sc',
    );
  });

  it('Vencimento: o Trichoderma vence em 12 dias com sobra estimada', () => {
    expect(analyze().alerts.find((a) => a.id === 'VENCIMENTO:trichoderma')?.justificativa).toMatch(
      /^Vence em 12 dia\(s\); .*devem sobrar cerca de .* L sem uso\./,
    );
  });

  it('Fora do padrão: a retirada de 950 L de diesel é 15,8 vezes a média', () => {
    expect(analyze().alerts.find((a) => a.id === 'ANOMALIA:diesel')?.justificativa).toContain(
      'Retirada de 950 L, 15,8 vezes a média das 13 retiradas anteriores (60 L).',
    );
  });

  it('todo alerta termina com o que fazer (tarefa 12.5)', () => {
    for (const alert of analyze().alerts) expect(alert.justificativa).toMatch(/ O que fazer: [^.]+\.$/);
  });

  it('Falta: sugere comprar a ureia para 30 dias de uso, com o custo (tarefa 12.5)', () => {
    // 85 sc em 18 dias = 4,72 sc/dia; 30 dias = 141,7 sc; menos 15 em estoque = 126,7, arredonda para 127.
    expect(analyze().alerts.find((a) => a.id === 'FALTA:ureia')?.justificativa).toMatch(
      /O que fazer: comprar cerca de 127 sc \(cerca de R\$ 20320\) para 30 dias de uso\.$/,
    );
  });

  it('Capital parado: o MAP é classe A, com R$ 147.000 imobilizados', () => {
    const map = analyze().products.find((p) => p.id === 'map');
    expect(map?.classeAbc).toBe('A');
    expect(map?.valorEstoque).toBe(147_000);
  });
});
