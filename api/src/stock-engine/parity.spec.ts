import { describe, expect, it } from 'vitest';
import { analyzeStockInventory } from './stock-engine';
import { analyzeInventory } from '../../../client/src/offline/analysis';
import { getOfficialSeedDataset } from '../stock/official-seed.data';

// Same fixtures, same reference date: the API engine (Date objects, as Prisma
// returns them) must reach the same results as the client the user sees
// (ISO strings, as SQLite stores them). Tarefa 10.3.
const NOW = new Date('2026-10-20T15:00:00.000Z');
const DAY = 86_400_000;
const at = (days: number, hour = 12) =>
  new Date(Date.UTC(2026, 9, 20 + days, hour)).toISOString();

interface P {
  id: string;
  nome?: string;
  unidadeMedida?: string;
  estoqueMinimo?: number;
  precoAquisicao?: number | null;
  validade?: string | null;
}
interface M {
  productId: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  dataMovimento: string;
}

const product = (p: P) => ({
  farmId: 'f1',
  nome: p.id,
  categoria: 'Teste',
  unidadeMedida: 'un',
  estoqueMinimo: 0,
  precoAquisicao: 10,
  validade: null,
  ...p,
});
const movement = (m: M, i: number) => ({ id: `m${i}`, farmId: 'f1', responsavel: 'Ana', ...m });

const outs = (productId: string, quantities: number[], firstDay: number) =>
  quantities.map((quantidade, i): M => ({
    productId,
    tipo: 'SAIDA',
    quantidade,
    dataMovimento: at(firstDay + i),
  }));

function compare(products: P[], movements: M[], now = NOW) {
  const ps = products.map(product);
  const ms = movements.map(movement);
  const client = analyzeInventory(ps, ms, now);
  const api = analyzeStockInventory(
    ps.map((p) => ({ ...p, validade: p.validade ? new Date(p.validade) : null })),
    ms.map((m) => ({ ...m, dataMovimento: new Date(m.dataMovimento) })),
    now,
  );
  const view = (a: typeof client | typeof api) => ({
    products: a.products
      .map((p) => ({
        id: p.id,
        saldo: p.saldo,
        consumoMedioDiario: p.consumoMedioDiario,
        diasRestantes: p.diasRestantes,
        valorEstoque: p.valorEstoque,
        classeAbc: p.classeAbc,
        percentualValor: p.percentualValor,
        amostrasConsumo: p.amostrasConsumo,
        diasAmostra: p.diasAmostra,
        confiabilidade: p.confiabilidade,
        consumoDiario: p.consumoDiario,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    alerts: a.alerts,
    totalValue: a.totalValue,
    pricedProductCount: a.pricedProductCount,
    unpricedProductCount: a.unpricedProductCount,
    balancesByUnit: a.balancesByUnit,
  });
  expect(view(api)).toEqual(view(client));
  return api;
}

describe('paridade API × cliente na análise de estoque (tarefa 10.3)', () => {
  it('base simulada de demonstração inteira', () => {
    const dataset = getOfficialSeedDataset();
    const now = new Date();
    const products = dataset.products.map((p) => ({
      id: p.ref,
      nome: p.nome,
      unidadeMedida: p.unidadeMedida,
      estoqueMinimo: p.estoqueMinimo,
      precoAquisicao: p.precoAquisicao ?? null,
      validade: p.validade ? p.validade.toISOString() : null,
    }));
    const movements = dataset.movements.map((m) => ({
      productId: m.productRef,
      tipo: m.tipo,
      quantidade: m.quantidade,
      dataMovimento: m.dataMovimento.toISOString(),
    }));
    const api = compare(products, movements, now);
    expect(api.alerts.length).toBeGreaterThan(0);
  });

  it('listas vazias, nulas e produto sem movimentação', () => {
    compare([], []);
    const api = compare([{ id: 'p' }], []);
    expect(api.products[0]).toMatchObject({ saldo: 0, confiabilidade: 'INDISPONIVEL' });
    expect(analyzeStockInventory(null, undefined, NOW)).toMatchObject({ products: [], alerts: [] });
  });

  it('litros e quilos ficam em saldos separados por unidade', () => {
    const api = compare(
      [
        { id: 'diesel', unidadeMedida: 'L' },
        { id: 'oleo', unidadeMedida: 'L' },
        { id: 'ureia', unidadeMedida: 'kg' },
      ],
      [
        { productId: 'diesel', tipo: 'ENTRADA', quantidade: 500, dataMovimento: at(-5) },
        { productId: 'oleo', tipo: 'ENTRADA', quantidade: 20, dataMovimento: at(-5) },
        { productId: 'ureia', tipo: 'ENTRADA', quantidade: 300, dataMovimento: at(-5) },
      ],
    );
    expect(api.balancesByUnit).toEqual({ L: 520, kg: 300 });
  });

  it('validade vencida, vencendo hoje, em 30 dias e em 31 dias', () => {
    compare(
      [
        { id: 'vencido', validade: at(-1) },
        { id: 'hoje', validade: at(0, 3) },
        { id: 'trinta', validade: at(30) },
        { id: 'trinta-e-um', validade: at(31) },
      ],
      ['vencido', 'hoje', 'trinta', 'trinta-e-um'].flatMap((id) => [
        { productId: id, tipo: 'ENTRADA' as const, quantidade: 50, dataMovimento: at(-10) },
        { productId: id, tipo: 'SAIDA' as const, quantidade: 1, dataMovimento: at(-2) },
      ]),
    );
  });

  it('poucas amostras levam o aviso de base limitada', () => {
    const api = compare(
      [{ id: 'p' }],
      [
        { productId: 'p', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-3) },
        ...outs('p', [4], -1),
      ],
    );
    expect(api.alerts.find((a) => a.tipo === 'FALTA')?.justificativa).toMatch(/poucos dados/);
  });

  it('limiares exatos: autonomia de 7, 15, 90 e 91 dias e saldo igual ao mínimo', () => {
    // 1 un/dia em 10 dias de amostra: saldo = autonomia em dias.
    const daily = (id: string) => outs(id, Array(10).fill(1), -9);
    const entry = (id: string, saldo: number): M => ({
      productId: id,
      tipo: 'ENTRADA',
      quantidade: saldo + 10,
      dataMovimento: at(-20),
    });
    const api = compare(
      [
        { id: 'd7' },
        { id: 'd15' },
        { id: 'd90' },
        { id: 'd91' },
        { id: 'minimo', estoqueMinimo: 50 },
      ],
      [
        ...['d7', 'd15', 'd90', 'd91'].flatMap((id) => [entry(id, Number(id.slice(1))), ...daily(id)]),
        entry('minimo', 50),
        ...daily('minimo'),
      ],
    );
    const levels = Object.fromEntries(api.alerts.map((a) => [`${a.tipo}:${a.productId}`, a.nivel]));
    expect(levels).toMatchObject({
      'FALTA:d7': 'URGENTE',
      'FALTA:d15': 'ATENCAO',
      'FALTA:minimo': 'URGENTE',
      'EXCESSO:d91': 'INFORMATIVO',
    });
    expect(levels['EXCESSO:d90']).toBeUndefined();
  });

  it('anomalia só olha as retiradas da janela de 30 dias', () => {
    compare(
      [{ id: 'recente' }, { id: 'antigo' }],
      [
        { productId: 'recente', tipo: 'ENTRADA', quantidade: 5000, dataMovimento: at(-40) },
        ...outs('recente', [60, 60, 60, 950], -4),
        { productId: 'antigo', tipo: 'ENTRADA', quantidade: 5000, dataMovimento: at(-60) },
        ...outs('antigo', [60, 60, 60], -50),
        ...outs('antigo', [950], -1),
      ],
    );
  });

  it('estoque parado, saldo zerado ou negativo, preço zero e preço ausente', () => {
    const api = compare(
      [
        { id: 'parado', precoAquisicao: 4200 },
        { id: 'zerado', estoqueMinimo: 5 },
        { id: 'negativo' },
        { id: 'gratis', precoAquisicao: 0 },
        { id: 'sem-preco', precoAquisicao: null },
        { id: 'so-saida' },
      ],
      [
        { productId: 'parado', tipo: 'ENTRADA', quantidade: 35, dataMovimento: at(-90) },
        { productId: 'zerado', tipo: 'ENTRADA', quantidade: 5, dataMovimento: at(-10) },
        { productId: 'zerado', tipo: 'SAIDA', quantidade: 5, dataMovimento: at(-1) },
        { productId: 'negativo', tipo: 'SAIDA', quantidade: 3, dataMovimento: at(-2) },
        { productId: 'gratis', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-2) },
        { productId: 'sem-preco', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-2) },
        { productId: 'so-saida', tipo: 'SAIDA', quantidade: 1, dataMovimento: at(-45) },
      ],
    );
    expect(api.unpricedProductCount).toBe(1);
    expect(api.products.find((p) => p.id === 'sem-preco')).toMatchObject({
      valorEstoque: null,
      classeAbc: null,
      percentualValor: null,
    });
  });

  it('cobertura financeira: todos com preço e nenhum com preço (tarefa 10.4)', () => {
    const entries = (ids: string[]): M[] =>
      ids.map((id) => ({ productId: id, tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-2) }));

    const todos = compare([{ id: 'a', precoAquisicao: 5 }, { id: 'b', precoAquisicao: 0 }], entries(['a', 'b']));
    expect(todos).toMatchObject({ totalValue: 50, pricedProductCount: 2, unpricedProductCount: 0 });

    const nenhum = compare([{ id: 'a', precoAquisicao: null }, { id: 'b', precoAquisicao: null }], entries(['a', 'b']));
    expect(nenhum).toMatchObject({ totalValue: 0, pricedProductCount: 0, unpricedProductCount: 2 });
    expect(nenhum.products.every((p) => p.valorEstoque === null && p.classeAbc === null)).toBe(true);
  });

  it('movimentações futuras ou de outra fazenda não entram na conta', () => {
    const api = compare(
      [{ id: 'p' }],
      [
        { productId: 'p', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-3) },
        { productId: 'p', tipo: 'ENTRADA', quantidade: 999, dataMovimento: new Date(NOW.getTime() + DAY).toISOString() },
      ],
    );
    expect(api.products[0].saldo).toBe(10);
  });

  it('alertas saem ordenados: urgente, atenção, informativo', () => {
    const api = compare(
      [{ id: 'a-parado' }, { id: 'z-urgente', estoqueMinimo: 100 }],
      [
        { productId: 'a-parado', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-60) },
        { productId: 'z-urgente', tipo: 'ENTRADA', quantidade: 10, dataMovimento: at(-1) },
      ],
    );
    expect(api.alerts.map((a) => a.nivel)).toEqual(['URGENTE', 'INFORMATIVO']);
  });
});
