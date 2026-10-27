import { describe, expect, it } from 'vitest';
import { getOfficialSeedDataset, type OfficialSeedDataset } from './official-seed.data';
import { prepareDemoLoad } from './demo-load';

const base = (): OfficialSeedDataset => ({
  ...getOfficialSeedDataset(),
  products: [
    {
      ref: 'ureia',
      nome: 'Ureia 46% N',
      categoria: 'Fertilizantes',
      unidadeMedida: 'sc',
      estoqueMinimo: 10,
      precoAquisicao: 160,
    },
  ],
  movements: [
    {
      productRef: 'ureia',
      tipo: 'ENTRADA',
      quantidade: 20,
      dataMovimento: new Date('2026-10-01T12:00:00Z'),
      responsavel: 'Gestor',
      destino: 'Almoxarifado',
    },
  ],
});

describe('prepareDemoLoad (tarefa 10.1)', () => {
  it('aceita a base simulada inteira sem rejeições', () => {
    const dataset = getOfficialSeedDataset();
    const { products, movements, relatorio } = prepareDemoLoad(dataset);
    expect(products).toHaveLength(dataset.products.length);
    expect(movements).toHaveLength(dataset.movements.length);
    expect(relatorio.produtos).toEqual({ validos: dataset.products.length, rejeitados: [] });
    expect(relatorio.movimentacoes).toEqual({ validas: dataset.movements.length, rejeitadas: [] });
    expect(relatorio.origem).toBe('SIMULADO');
  });

  it('aceita listas vazias e devolve relatório zerado', () => {
    const { products, movements, relatorio } = prepareDemoLoad({ ...base(), products: [], movements: [] });
    expect(products).toEqual([]);
    expect(movements).toEqual([]);
    expect(relatorio.produtos).toEqual({ validos: 0, rejeitados: [] });
    expect(relatorio.movimentacoes).toEqual({ validas: 0, rejeitadas: [] });
    expect(relatorio.tratamentos).toEqual([]);
  });

  it('rejeita produtos sem ref, nome, categoria ou unidade e com estoque mínimo inválido', () => {
    const dataset = base();
    dataset.products.push(
      { ...dataset.products[0], ref: '' },
      { ...dataset.products[0], ref: 'a', nome: '  ' },
      { ...dataset.products[0], ref: 'b', categoria: null as never },
      { ...dataset.products[0], ref: 'c', unidadeMedida: undefined as never },
      { ...dataset.products[0], ref: 'd', estoqueMinimo: -1 },
      { ...dataset.products[0], ref: 'e', estoqueMinimo: Number.NaN },
    );
    const { products, relatorio } = prepareDemoLoad(dataset);
    expect(products.map((p) => p.ref)).toEqual(['ureia']);
    expect(relatorio.produtos.rejeitados.map((r) => r.linha)).toEqual([2, 3, 4, 5, 6, 7]);
    for (const r of relatorio.produtos.rejeitados) expect(r.motivo).not.toBe('');
  });

  it('rejeita ref duplicada em vez de mesclar, e mantém separados produtos de nomes parecidos', () => {
    const dataset = base();
    dataset.products.push(
      { ...dataset.products[0], nome: 'Outra ureia' },
      { ...dataset.products[0], ref: 'ureia_2', nome: 'UREIA 46% n' },
    );
    const { products, relatorio } = prepareDemoLoad(dataset);
    expect(products.map((p) => p.ref)).toEqual(['ureia', 'ureia_2']);
    expect(relatorio.produtos.rejeitados).toEqual([
      { linha: 2, ref: 'ureia', motivo: expect.stringMatching(/duplicad/i) },
    ]);
  });

  it('aceita estoque mínimo zero', () => {
    const dataset = base();
    dataset.products[0].estoqueMinimo = 0;
    expect(prepareDemoLoad(dataset).products[0].estoqueMinimo).toBe(0);
  });

  it('padroniza apelidos de unidade e registra o tratamento', () => {
    const dataset = base();
    dataset.products[0].unidadeMedida = ' Sacas ';
    dataset.products.push(
      { ...dataset.products[0], ref: 'diesel', unidadeMedida: 'litros' },
      { ...dataset.products[0], ref: 'kcl', unidadeMedida: 'KG' },
    );
    const { products, relatorio } = prepareDemoLoad(dataset);
    expect(products.map((p) => p.unidadeMedida)).toEqual(['sc', 'L', 'kg']);
    expect(relatorio.tratamentos).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ureia'),
        expect.stringContaining('diesel'),
        expect.stringContaining('kcl'),
      ]),
    );
  });

  it('mantém unidade não reconhecida, mas avisa no relatório', () => {
    const dataset = base();
    dataset.products[0].unidadeMedida = 'galão';
    const { products, relatorio } = prepareDemoLoad(dataset);
    expect(products[0].unidadeMedida).toBe('galão');
    expect(relatorio.tratamentos).toEqual([expect.stringMatching(/ureia.*galão.*não reconhecida/i)]);
  });

  it('preço e validade ausentes viram desconhecidos (null), nunca zero, e são relatados', () => {
    const dataset = base();
    dataset.products[0].precoAquisicao = undefined;
    dataset.products[0].validade = undefined;
    dataset.products.push({ ...dataset.products[0], ref: 'b', precoAquisicao: -5, validade: new Date('x') });
    const { products, relatorio } = prepareDemoLoad(dataset);
    expect(products.map((p) => [p.precoAquisicao, p.validade])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(relatorio.tratamentos).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/ureia.*preço ausente/i),
        expect.stringMatching(/b.*preço inválido/i),
        expect.stringMatching(/b.*validade inválida/i),
      ]),
    );
  });

  it('rejeita movimentações com produto inexistente, tipo, quantidade ou data inválidos', () => {
    const dataset = base();
    const ok = dataset.movements[0];
    dataset.movements.push(
      { ...ok, productRef: 'fantasma' },
      { ...ok, tipo: 'AJUSTE' as never },
      { ...ok, quantidade: 0 },
      { ...ok, quantidade: -3 },
      { ...ok, quantidade: Number.POSITIVE_INFINITY },
      { ...ok, dataMovimento: new Date('não é data') },
      { ...ok, dataMovimento: null as never },
    );
    const { movements, relatorio } = prepareDemoLoad(dataset);
    expect(movements).toHaveLength(1);
    expect(relatorio.movimentacoes.validas).toBe(1);
    expect(relatorio.movimentacoes.rejeitadas.map((r) => r.linha)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('rejeita movimentações de produto que foi rejeitado', () => {
    const dataset = base();
    dataset.products[0].nome = '';
    const { movements, relatorio } = prepareDemoLoad(dataset);
    expect(movements).toEqual([]);
    expect(relatorio.movimentacoes.rejeitadas).toEqual([
      { linha: 1, ref: 'ureia', motivo: expect.stringMatching(/produto/i) },
    ]);
  });

  it('responsável ausente vira "Não informado" e destino ausente vira null, com tratamento relatado', () => {
    const dataset = base();
    dataset.movements[0].responsavel = '' as never;
    dataset.movements[0].destino = undefined as never;
    const { movements, relatorio } = prepareDemoLoad(dataset);
    expect(movements[0]).toMatchObject({ responsavel: 'Não informado', destino: null });
    expect(relatorio.tratamentos).toEqual([expect.stringMatching(/linha 1.*responsável ausente/i)]);
  });
});
