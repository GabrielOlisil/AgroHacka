import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@prisma/client';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import type { SyncIdentity } from '../auth/auth.service';

const identity: SyncIdentity = {
  actorId: 'manager',
  farmId: 'farm-a',
  role: 'GESTOR',
  nome: 'Ana',
};
const id = '12345678-1234-4234-9234-123456789abc';
const date = new Date('2026-10-27T12:00:00.000Z');
const product = (over: Partial<Product> = {}): Product => ({
  id,
  farmId: 'farm-a',
  nome: 'Uréia Fertilizante 46',
  categoria: 'Fertilizantes',
  unidadeMedida: 'kg',
  estoqueMinimo: 10,
  precoAquisicao: null,
  validade: null,
  lote: null,
  fornecedor: null,
  ativo: true,
  excluidoEm: null,
  createdAt: date,
  updatedAt: date,
  ...over,
});

describe('ProductsService: editar, desativar e excluir insumo', () => {
  let service: ProductsService;
  let rows: Map<string, Product>;
  let movements: number;
  let tx: any;
  let prisma: any;
  beforeEach(() => {
    rows = new Map([[id, product()]]);
    movements = 0;
    tx = {
      $queryRawUnsafe: vi.fn(async () => [{ id: identity.farmId }]),
      product: {
        findFirst: vi.fn(async ({ where }: any) => {
          const row = rows.get(where.id);
          return row?.farmId === where.farmId &&
            (where.excluidoEm !== null || row?.excluidoEm === null)
            ? row
            : null;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const row = { ...rows.get(where.id)!, ...data, updatedAt: date };
          rows.set(where.id, row);
          return row;
        }),
      },
      stockMovement: { count: vi.fn(async () => movements) },
    };
    prisma = { $transaction: vi.fn(async (work: any) => work(tx)) };
    service = new ProductsService(prisma);
  });

  it('edita os campos do cadastro, normalizando a unidade, sem tocar no id nem na fazenda', async () => {
    const result = await service.update(
      id,
      {
        nome: '  Ureia Fertilizante 46% N ',
        categoria: 'Adubos',
        unidadeMedida: 'quilos',
        estoqueMinimo: 0,
        precoAquisicao: 3.5,
        validade: '2027-01-31',
        lote: 'L-9',
        fornecedor: null,
      },
      identity,
    );
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
      identity.farmId,
    );
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id },
      data: {
        nome: 'Ureia Fertilizante 46% N',
        categoria: 'Adubos',
        unidadeMedida: 'kg',
        estoqueMinimo: 0,
        precoAquisicao: 3.5,
        validade: new Date('2027-01-31T00:00:00.000Z'),
        lote: 'L-9',
        fornecedor: null,
      },
    });
    expect(result).toMatchObject({
      id,
      farmId: 'farm-a',
      nome: 'Ureia Fertilizante 46% N',
      validade: '2027-01-31T00:00:00.000Z',
      ativo: true,
      excluidoEm: null,
    });
  });

  it('desativa e reativa um insumo com histórico', async () => {
    movements = 3;
    expect(await service.update(id, { ativo: false }, identity)).toMatchObject(
      { ativo: false },
    );
    expect(await service.update(id, { ativo: true }, identity)).toMatchObject({
      ativo: true,
    });
  });

  it('recusa trocar a unidade de um insumo que já tem movimentações', async () => {
    movements = 1;
    await expect(
      service.update(id, { unidadeMedida: 'L' }, identity),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.product.update).not.toHaveBeenCalled();
    // A mesma unidade, escrita com outro apelido, não é troca.
    await expect(
      service.update(id, { unidadeMedida: 'Quilo', nome: 'Ureia' }, identity),
    ).resolves.toMatchObject({ nome: 'Ureia', unidadeMedida: 'kg' });
  });

  it.each([
    [{}],
    [{ id: 'outro' }],
    [{ farmId: 'farm-b' }],
    [{ nome: '   ' }],
    [{ nome: null }],
    [{ estoqueMinimo: -1 }],
    [{ estoqueMinimo: null }],
    [{ precoAquisicao: Number.NaN }],
    [{ validade: '2026-02-30' }],
    [{ ativo: 'false' }],
    [{ excluidoEm: null }],
  ])('recusa alteração inválida %j sem gravar', async (patch) => {
    await expect(
      service.update(id, patch as any, identity),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('não encontra insumo de outra fazenda, inexistente ou já excluído', async () => {
    rows.set('outro', product({ id: 'outro', farmId: 'farm-b' }));
    rows.set('apagado', product({ id: 'apagado', excluidoEm: date }));
    for (const target of ['outro', 'inexistente', 'apagado']) {
      await expect(
        service.update(target, { nome: 'X' }, identity),
      ).rejects.toMatchObject({ status: 404 });
      await expect(service.remove(target, identity)).rejects.toMatchObject({
        status: 404,
      });
    }
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('somente o gestor edita ou exclui', async () => {
    const operator = { ...identity, role: 'OPERADOR' } as SyncIdentity;
    await expect(
      service.update(id, { nome: 'X' }, operator),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.remove(id, operator)).rejects.toMatchObject({
      status: 403,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('exclui um insumo sem movimentações, marcando a exclusão para os celulares', async () => {
    const result = await service.remove(id, identity);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id },
      data: { excluidoEm: expect.any(Date) },
    });
    expect(result.excluidoEm).toEqual(expect.any(String));
    expect(rows.get(id)!.excluidoEm).toBeInstanceOf(Date);
  });

  it('não exclui insumo com histórico e orienta a desativar', async () => {
    movements = 2;
    await expect(service.remove(id, identity)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('Desative'),
    });
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});

describe('ProductsController: rotas de edição e exclusão', () => {
  it('autentica e repassa PATCH e DELETE ao serviço', async () => {
    const products = {
      update: vi.fn(async () => ({ id })),
      remove: vi.fn(async () => ({ id })),
    };
    const auth = { authenticateSync: vi.fn(async () => identity) };
    const controller = new ProductsController(products as any, auth as any);
    const request = { get: (name: string) => `h-${name}` } as any;
    await controller.update(id, { nome: 'Ureia' }, request);
    await controller.remove(id, request);
    expect(auth.authenticateSync).toHaveBeenCalledWith(
      'h-authorization',
      'h-x-device-token',
    );
    expect(products.update).toHaveBeenCalledWith(id, { nome: 'Ureia' }, identity);
    expect(products.remove).toHaveBeenCalledWith(id, identity);
  });
});
