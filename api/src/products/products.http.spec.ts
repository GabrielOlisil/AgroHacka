import 'reflect-metadata';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsModule } from './products.module';
import { CreateProductDto } from './dto/products.dto';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from '../auth/jwt-secret';

const input = {
  id: '12345678-1234-4234-9234-123456789abc',
  nome: 'Adubo',
  categoria: 'Personalizada 🌱',
  unidadeMedida: 'kg',
  estoqueMinimo: 0,
};
const secret = () => resolveJwtSecret(process.env);
const token = (sub = 'manager-a', farmId = 'farm-a', options = {}) =>
  jwt.sign({ sub, farmId }, secret(), { expiresIn: '1h', ...options });

describe('POST /products HTTP: real authentication and product service', () => {
  let app: INestApplication;
  const rows = new Map<string, any>();
  const transaction = vi.fn(async (work: any) =>
    work({
      $queryRawUnsafe: async () => [{ id: 'farm' }],
      product: {
        findFirst: async ({ where }: any) => {
          const row = rows.get(where.id);
          return row?.farmId === where.farmId ? row : null;
        },
        create: async ({ data }: any) => {
          if (rows.has(data.id))
            throw new Prisma.PrismaClientKnownRequestError('unique', {
              code: 'P2002',
              clientVersion: '6',
            });
          const row = {
            ...data,
            ativo: true,
            excluidoEm: null,
            createdAt: new Date('2026-10-27T12:00:00Z'),
            updatedAt: new Date('2026-10-27T12:00:00Z'),
          };
          rows.set(row.id, row);
          return row;
        },
      },
    }),
  );
  beforeAll(async () => {
    Reflect.defineMetadata(
      'design:paramtypes',
      [ProductsService, AuthService],
      ProductsController,
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [CreateProductDto, Object],
      ProductsController.prototype,
      'create',
    );
    Reflect.defineMetadata(
      'design:paramtypes',
      [PrismaService],
      ProductsService,
    );
    Reflect.defineMetadata('design:paramtypes', [PrismaService], AuthService);
    const module = await Test.createTestingModule({
      imports: [ProductsModule],
      providers: [{ provide: PrismaService, useValue: {} }],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: transaction,
        user: {
          findUnique: async ({ where }: any) => {
            if (!['manager-a', 'manager-b', 'operator-user'].includes(where.id))
              return null;
            return {
              id: where.id,
              nome: 'Ana',
              role: where.id === 'operator-user' ? 'OPERADOR' : 'GESTOR',
              farmId: where.id === 'manager-b' ? 'farm-b' : 'farm-a',
            };
          },
        },
        device: {
          findUnique: async ({ where }: any) =>
            where.deviceToken === 'active-device'
              ? {
                  id: 'device-a',
                  farmId: 'farm-a',
                  ativo: true,
                  nomeOperador: 'Bruno',
                }
              : null,
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    rows.clear();
    transaction.mockClear();
  });

  it('registers ProductsModule in AppModule', () => {
    expect(Reflect.getMetadata('imports', AppModule)).toContain(ProductsModule);
  });
  it('documents bearer security without extra header parameters so clients use generic headers', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const operation = document.paths['/products'].post!;
    expect(operation.security).toContainEqual({ bearer: [] });
    expect(
      operation.parameters?.filter((p) => 'in' in p && p.in === 'header') ?? [],
    ).toEqual([]);
  });
  it('creates with the identity farm and returns a stable canonical DTO on retry', async () => {
    const first = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send(input)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send(input)
      .expect(201);
    expect(retry.body).toEqual(first.body);
    expect(first.body).toEqual({
      ...input,
      farmId: 'farm-a',
      precoAquisicao: null,
      validade: null,
      lote: null,
      fornecedor: null,
      ativo: true,
      excluidoEm: null,
      createdAt: '2026-10-27T12:00:00.000Z',
      updatedAt: '2026-10-27T12:00:00.000Z',
    });
    expect(rows.size).toBe(1);
  });
  it('accepts custom units, Unicode category and lot/supplier with nullable price and expiry', async () => {
    const result = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        ...input,
        unidadeMedida: 'm²',
        precoAquisicao: 0,
        validade: '2028-02-29',
        lote: ' A ',
        fornecedor: ' João ',
      })
      .expect(201);
    expect(result.body).toMatchObject({
      unidadeMedida: 'm²',
      precoAquisicao: 0,
      validade: '2028-02-29T00:00:00.000Z',
      lote: 'A',
      fornecedor: 'João',
    });
  });
  it.each([
    undefined,
    'Bearer invalid',
    `Bearer ${jwt.sign({ sub: 'manager-a', farmId: 'farm-a' }, 'wrong-secret')}`,
  ])('rejects unauthenticated or invalid credentials %s', async (header) => {
    const req = request(app.getHttpServer()).post('/products');
    if (header) req.set('Authorization', header);
    await req.send(input).expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects expired, deleted-user, operator-user and forged farm JWT sessions', async () => {
    for (const authorization of [
      token('manager-a', 'farm-a', { expiresIn: -1 }),
      token('deleted'),
      token('operator-user'),
      token('manager-a', 'farm-b'),
    ]) {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authorization}`)
        .send(input)
        .expect(401);
    }
    expect(transaction).not.toHaveBeenCalled();
  });
  it('forbids active operator device tokens; rejects revoked devices and mixed credentials', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('x-device-token', 'active-device')
      .send(input)
      .expect(403);
    await request(app.getHttpServer())
      .post('/products')
      .set('x-device-token', 'revoked-device')
      .send(input)
      .expect(401);
    await request(app.getHttpServer())
      .post('/products')
      .set('x-device-token', 'active-device')
      .set('Authorization', `Bearer ${token()}`)
      .send(input)
      .expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('returns the same generic conflict for changed payload and cross-farm UUID collision without disclosing foreign content', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send(input)
      .expect(201);
    const own = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send({ ...input, nome: 'Other' })
      .expect(409);
    const foreign = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token('manager-b', 'farm-b')}`)
      .send(input)
      .expect(409);
    expect(foreign.body).toEqual(own.body);
    expect(JSON.stringify(foreign.body)).not.toMatch(
      /Adubo|farm-a|Personalizada/,
    );
    expect(rows.size).toBe(1);
  });
  it.each([
    {},
    [],
    { ...input, farmId: 'farm-b' },
    { ...input, estoqueMinimo: null },
    { ...input, estoqueMinimo: '2' },
    { ...input, estoqueMinimo: -1 },
    { ...input, precoAquisicao: '3' },
    { ...input, nome: '' },
    { ...input, categoria: '  ' },
    { ...input, unidadeMedida: '' },
    { ...input, validade: '2026-02-30' },
    { ...input, saldoInicial: 9 },
  ])('rejects malformed HTTP JSON %j without writes', async (body) => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token()}`)
      .send(body)
      .expect(400);
    expect(transaction).not.toHaveBeenCalled();
  });
});
