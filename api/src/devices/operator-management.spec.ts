import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { AuthService } from '../auth/auth.service';

const identity = {
  role: 'GESTOR',
  farmId: 'farm-a',
  actorId: 'gestor',
  nome: 'Ana',
};
describe('operator administration preserves history and scopes every write', () => {
  const updateMany = vi.fn();
  const deleteMany = vi.fn();
  const lock = vi.fn();
  const transaction = vi.fn();
  let service: DevicesService;
  beforeEach(() => {
    vi.resetAllMocks();
    lock.mockResolvedValue([{ id: 'farm-a' }]);
    updateMany.mockResolvedValue({ count: 1 });
    deleteMany.mockResolvedValue({ count: 1 });
    const tx = { $queryRawUnsafe: lock, device: { updateMany, deleteMany } };
    transaction.mockImplementation(async (callback) => callback(tx));
    service = new DevicesService({ $transaction: transaction } as never);
  });
  it('edits only device metadata under the same farm lock used by sync', async () => {
    await expect(
      service.updateOperator('farm-a', 'd', {
        nomeOperador: '  João  ',
        ativo: false,
      }),
    ).resolves.toEqual({ farmId: 'farm-a', id: 'd', sucesso: true });
    expect(lock).toHaveBeenCalledWith(
      'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
      'farm-a',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { farmId: 'farm-a', id: 'd' },
      data: { nomeOperador: 'João', ativo: false },
    });
    expect(deleteMany).not.toHaveBeenCalled();
  });
  it.each([{ ativo: true }, { ativo: false }, { nomeOperador: 'José 🌱' }])(
    'accepts the supported partial update %j',
    async (patch) => {
      await service.updateOperator('farm-a', 'd', patch);
      expect(updateMany).toHaveBeenCalledWith({
        where: { farmId: 'farm-a', id: 'd' },
        data: patch,
      });
    },
  );
  it.each([
    null,
    undefined,
    [],
    {},
    { nomeOperador: null },
    { nomeOperador: '' },
    { nomeOperador: '  ' },
    { nomeOperador: 4 },
    { ativo: null },
    { ativo: 0 },
    { ativo: 'true' },
    { farmId: 'foreign' },
    { deviceToken: 'changed' },
    { nomeOperador: 'x'.repeat(101) },
  ])(
    'rejects invalid/forged fields before any transaction %j',
    async (body) => {
      await expect(
        service.updateOperator('farm-a', 'd', body as never),
      ).rejects.toMatchObject({ status: 400 });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it.each(['', '  ', null, undefined])(
    'rejects absent device IDs %s',
    async (id) => {
      await expect(
        service.deleteOperator('farm-a', id as never),
      ).rejects.toMatchObject({ status: 400 });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it('does not edit an absent or foreign operator', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateOperator('farm-a', 'foreign', { ativo: false }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('deletes only the scoped device; repeating the request is harmless and touches no movements/receipts', async () => {
    deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    for (let i = 0; i < 2; i++)
      await expect(service.deleteOperator('farm-a', 'd')).resolves.toEqual({
        farmId: 'farm-a',
        id: 'd',
        sucesso: true,
      });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'd', farmId: 'farm-a' },
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('operator administration HTTP authorization', () => {
  let app: INestApplication;
  const update = vi
    .fn()
    .mockResolvedValue({ farmId: 'farm-a', id: 'd', sucesso: true });
  const remove = vi
    .fn()
    .mockResolvedValue({ farmId: 'farm-a', id: 'd', sucesso: true });
  beforeAll(async () => {
    Reflect.defineMetadata(
      'design:paramtypes',
      [DevicesService, AuthService],
      DevicesController,
    );
    const module = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesService,
          useValue: { updateOperator: update, deleteOperator: remove },
        },
        {
          provide: AuthService,
          useValue: {
            authenticateSync: async (auth?: string, token?: string) => {
              if (auth && token) throw new UnauthorizedException();
              if (auth === 'Bearer manager') return identity;
              if (token === 'operator' || auth === 'Bearer operator')
                return { ...identity, role: 'OPERADOR' };
              throw new UnauthorizedException();
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    update.mockClear();
    remove.mockClear();
  });
  it('derives the farm from the manager, ignoring a forged query scope', async () => {
    await request(app.getHttpServer())
      .patch('/devices/d?farmId=foreign')
      .set('Authorization', 'Bearer manager')
      .send({ ativo: false })
      .expect(200);
    expect(update).toHaveBeenCalledWith('farm-a', 'd', { ativo: false });
    await request(app.getHttpServer())
      .delete('/devices/d?farmId=foreign')
      .set('Authorization', 'Bearer manager')
      .expect(200);
    expect(remove).toHaveBeenCalledWith('farm-a', 'd');
  });
  it.each(['patch', 'delete'] as const)(
    'denies unauthenticated/operator/mixed credentials on %s',
    async (method) => {
      for (const [headers, status] of [
        [{}, 401],
        [{ Authorization: 'Bearer invalid' }, 401],
        [{ Authorization: 'Bearer operator' }, 403],
        [{ 'x-device-token': 'operator' }, 403],
        [
          { Authorization: 'Bearer manager', 'x-device-token': 'operator' },
          401,
        ],
      ] as const) {
        await request(app.getHttpServer())
          [method]('/devices/d')
          .set(headers)
          .send({ ativo: false })
          .expect(status);
      }
      expect(update).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    },
  );
});
