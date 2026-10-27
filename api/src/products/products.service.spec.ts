import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type Product } from '@prisma/client';
import { ProductsService } from './products.service';
import type { SyncIdentity } from '../auth/auth.service';

const identity: SyncIdentity = {
  actorId: 'manager',
  farmId: 'farm-a',
  role: 'GESTOR',
  nome: 'Ana',
};
const input = () => ({
  id: '12345678-1234-4234-9234-123456789abc',
  nome: 'Óleo',
  categoria: 'Manutenção / 自然 🌱',
  unidadeMedida: 'L',
  estoqueMinimo: 0,
});
const date = new Date('2026-10-27T12:00:00.000Z');

describe('ProductsService: create-only catalog', () => {
  let service: ProductsService;
  let rows: Map<string, Product>;
  let tx: any;
  let prisma: any;
  beforeEach(() => {
    rows = new Map();
    tx = {
      $queryRawUnsafe: vi.fn(async () => [{ id: identity.farmId }]),
      product: {
        findFirst: vi.fn(async ({ where }: any) => {
          const row = rows.get(where.id);
          return row?.farmId === where.farmId ? row : null;
        }),
        create: vi.fn(async ({ data }: any) => {
          if (rows.has(data.id))
            throw new Prisma.PrismaClientKnownRequestError('unique', {
              code: 'P2002',
              clientVersion: '6',
            });
          const row = { ...data, createdAt: date, updatedAt: date };
          rows.set(row.id, row);
          return row;
        }),
      },
      stockMovement: { create: vi.fn() },
    };
    prisma = { $transaction: vi.fn(async (work: any) => work(tx)) };
    service = new ProductsService(prisma);
  });

  it('locks the authenticated farm before looking up or creating a product and never creates opening stock', async () => {
    const result = await service.create(input(), identity);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
      identity.farmId,
    );
    expect(tx.$queryRawUnsafe.mock.invocationCallOrder[0]).toBeLessThan(
      tx.product.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.product.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.product.create.mock.invocationCallOrder[0],
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: { id: input().id, farmId: identity.farmId },
    });
    expect(result).toEqual({
      ...input(),
      farmId: identity.farmId,
      precoAquisicao: null,
      validade: null,
      lote: null,
      fornecedor: null,
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('normalizes text, UUID case, known units, optional nulls and real calendar expiry for a stable retry', async () => {
    const first = await service.create(
      {
        ...input(),
        id: input().id.toUpperCase(),
        nome: ' O\u0301leo ',
        unidadeMedida: ' litros ',
        validade: '2028-02-29',
        precoAquisicao: 0,
        lote: ' A-1 ',
        fornecedor: ' José ',
      },
      identity,
    );
    const retry = await service.create(
      {
        ...input(),
        validade: '2028-02-29',
        precoAquisicao: 0,
        lote: 'A-1',
        fornecedor: 'José',
      },
      identity,
    );
    expect(retry).toEqual(first);
    expect(first.validade).toBe('2028-02-29T00:00:00.000Z');
    expect(first.precoAquisicao).toBe(0);
    expect(tx.product.create).toHaveBeenCalledTimes(1);
  });

  it('treats absent and null optional fields identically on retry', async () => {
    const first = await service.create(input(), identity);
    expect(
      await service.create(
        {
          ...input(),
          precoAquisicao: null,
          validade: null,
          lote: null,
          fornecedor: null,
        },
        identity,
      ),
    ).toEqual(first);
    expect(tx.product.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['lt', 'L'],
    ['KG', 'kg'],
    ['unidades', 'un'],
    ['saca', 'sc'],
    ['tonelada', 't'],
    ['metros', 'm'],
    ['m²', 'm²'],
    ['m³', 'm³'],
    ['Caixa especial', 'Caixa especial'],
  ])(
    'accepts unit %s as %s without converting quantities',
    async (unidadeMedida, expected) => {
      const result = await service.create(
        { ...input(), unidadeMedida, estoqueMinimo: 1.25, precoAquisicao: 2.5 },
        identity,
      );
      expect(result.unidadeMedida).toBe(expected);
      expect(result.estoqueMinimo).toBe(1.25);
      expect(result.precoAquisicao).toBe(2.5);
    },
  );

  it.each([
    { nome: 'Outro' },
    { categoria: 'Outra' },
    { unidadeMedida: 'kg' },
    { estoqueMinimo: 1 },
    { precoAquisicao: 1 },
    { validade: '2026-12-31' },
    { lote: 'L1' },
    { fornecedor: 'Outro' },
  ])(
    'returns 409 without overwriting on changed payload %j',
    async (change) => {
      const first = await service.create(input(), identity);
      await expect(
        service.create({ ...input(), ...change }, identity),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.product.create).toHaveBeenCalledTimes(1);
      expect(await service.create(input(), identity)).toEqual(first);
    },
  );

  it('does not read or expose a foreign product when its globally unique UUID collides', async () => {
    await service.create(
      { ...input(), nome: 'Secret foreign name' },
      { ...identity, farmId: 'farm-b' },
    );
    tx.product.findFirst.mockClear();
    try {
      await service.create(input(), identity);
      expect.fail('must conflict');
    } catch (error: any) {
      expect(error.status).toBe(409);
      expect(JSON.stringify(error.getResponse())).not.toMatch(/Secret|farm-b/);
    }
    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: { id: input().id, farmId: identity.farmId },
    });
    expect(rows.size).toBe(1);
  });

  it('rejects operators and missing identity before opening a transaction', async () => {
    for (const actor of [undefined, { ...identity, role: 'OPERADOR' }]) {
      await expect(
        service.create(input(), actor as never),
      ).rejects.toMatchObject({ status: 403 });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a deleted farm under the lock without product access', async () => {
    tx.$queryRawUnsafe.mockResolvedValue([]);
    await expect(service.create(input(), identity)).rejects.toMatchObject({
      status: 403,
    });
    expect(tx.product.findFirst).not.toHaveBeenCalled();
    expect(tx.product.create).not.toHaveBeenCalled();
  });

  it('propagates infrastructure failures so a stable UUID can be retried', async () => {
    tx.product.create.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.create(input(), identity)).rejects.toThrow(
      'connection lost',
    );
    expect(rows.size).toBe(0);
    expect((await service.create(input(), identity)).id).toBe(input().id);
  });

  const invalid = [
    null,
    undefined,
    [],
    {},
    'text',
    ...['id', 'nome', 'categoria', 'unidadeMedida', 'estoqueMinimo'].flatMap(
      (field) =>
        [undefined, null, '', '   ', [], {}].map((value) => ({
          ...input(),
          [field]: value,
        })),
    ),
    ...['estoqueMinimo', 'precoAquisicao'].flatMap((field) =>
      [-1, NaN, Infinity, -Infinity, '2', true, [], {}].map((value) => ({
        ...input(),
        [field]: value,
      })),
    ),
    ...['validade'].flatMap((field) =>
      [
        '',
        '2026-02-29',
        '2026-02-30',
        '2026-13-01',
        '2026-04-31',
        '0000-01-01',
        '2026-10-27T12:00:00Z',
        1,
        true,
        {},
        [],
      ].map((value) => ({ ...input(), [field]: value })),
    ),
    ...['lote', 'fornecedor'].flatMap((field) =>
      ['', ' ', 1, true, {}, []].map((value) => ({
        ...input(),
        [field]: value,
      })),
    ),
    { ...input(), id: 'not-uuid' },
    { ...input(), nome: 1 },
    { ...input(), categoria: true },
    { ...input(), unidadeMedida: 1 },
    { ...input(), farmId: 'forged' },
    { ...input(), saldoInicial: 10 },
  ];
  it.each(invalid.map((value, index) => [index, value]))(
    'rejects malformed input case %i before touching the database',
    async (_index, value) => {
      await expect(
        service.create(value as never, identity),
      ).rejects.toMatchObject({ status: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
