import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { SyncService } from '../src/sync/sync.service';
import { SyncController } from '../src/sync/sync.controller';
import { AuthService } from '../src/auth/auth.service';
import { LocalStore } from '../../desktop/src/offline/local-store';
import { SyncCoordinator } from '../../desktop/src/offline/sync';
import { createApi } from '../../desktop/src/api/client';
import type { SqlDatabase, SqlValue } from '../../desktop/src/offline/database';

// No DATABASE_URL or real application database is read. This suite owns its
// loopback-only container, temporary volume and credentials from start to stop.
const container = `agrohacka-sync-test-${process.pid}`;
let owned = false;
let db: PrismaClient;
let second: PrismaClient;
let service: SyncService;
const farmId = randomUUID();
const productId = randomUUID();
const identity = {
  actorId: randomUUID(),
  farmId,
  role: 'GESTOR' as const,
  nome: 'Ana',
};
const other = {
  actorId: randomUUID(),
  deviceId: randomUUID(),
  farmId,
  role: 'OPERADOR' as const,
  nome: 'Bruno',
};
const movement = (overrides = {}) => ({
  id: randomUUID(),
  farmId,
  productId,
  tipo: 'SAIDA' as const,
  quantidade: 5,
  dataMovimento: '2026-10-01T12:00:00.000Z',
  responsavel: 'untrusted name',
  ...overrides,
});
const payload = (items: ReturnType<typeof movement>[] = []) => ({
  protocolVersion: 2 as const,
  farmId,
  pendingMovements: items,
});

beforeAll(async () => {
  execFileSync('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--publish',
    '127.0.0.1::5432',
    '--env',
    'POSTGRES_USER=sync_test',
    '--env',
    'POSTGRES_PASSWORD=sync_test',
    '--env',
    'POSTGRES_DB=sync_test',
    'postgres:16-alpine',
  ]);
  owned = true;
  const port = execFileSync('docker', ['port', container, '5432/tcp'], {
    encoding: 'utf8',
  })
    .trim()
    .split(':')
    .at(-1);
  if (!port || !/^\d+$/.test(port))
    throw new Error('Invalid isolated test port');
  const url = `postgresql://sync_test:sync_test@127.0.0.1:${port}/sync_test`;
  db = new PrismaClient({ datasources: { db: { url } } });
  second = new PrismaClient({ datasources: { db: { url } } });
  for (let attempt = 0; ; attempt++) {
    try {
      await db.$queryRaw`SELECT 1`;
      break;
    } catch (error) {
      if (attempt >= 40) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  const schema = execFileSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--script',
    ],
    { encoding: 'utf8' },
  );
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'sync_test',
      '-d',
      'sync_test',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: schema },
  );
  // Exercise the additive rollout against the baseline tables in this owned DB.
  await db.$executeRawUnsafe('DROP TABLE sync_receipts');
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'sync_test',
      '-d',
      'sync_test',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: readFileSync(
        'prisma/sync-migrations/002_sync_receipts.sql',
        'utf8',
      ),
    },
  );
  service = new SyncService(db as never);
});
beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE farms CASCADE');
  await db.farm.create({
    data: { id: farmId, nome: 'Sync test only', gestorId: identity.actorId },
  });
  await db.product.create({
    data: {
      id: productId,
      farmId,
      nome: 'Diesel',
      categoria: 'Combustível',
      unidadeMedida: 'L',
    },
  });
});
afterAll(async () => {
  await db?.$disconnect();
  await second?.$disconnect();
  if (owned) execFileSync('docker', ['stop', container], { stdio: 'ignore' });
});

describe('PostgreSQL sync transactions', () => {
  it('converges two real SQLite clients over Nest HTTP after a lost response, preserving a deficit and revoked-device outbox', async () => {
    const devices = await Promise.all(
      ['Ana', 'Bruno'].map((nomeOperador) =>
        db.device.create({
          data: {
            farmId,
            nomeOperador,
            deviceToken: randomUUID(),
            pairingCode: randomUUID(),
          },
        }),
      ),
    );
    await db.stockMovement.create({
      data: {
        ...movement({ tipo: 'ENTRADA', quantidade: 100 }),
        dataMovimento: new Date('2026-10-01'),
      },
    });
    // Vite transpiles decorators but does not emit constructor type metadata.
    Reflect.defineMetadata(
      'design:paramtypes',
      [SyncService, AuthService],
      SyncController,
    );
    const module = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        { provide: SyncService, useValue: service },
        { provide: AuthService, useValue: new AuthService(db as never) },
      ],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    const locals: DatabaseSync[] = [];
    function localStore() {
      const sqlite = new DatabaseSync(':memory:');
      locals.push(sqlite);
      sqlite.exec(
        readFileSync('../desktop/src-tauri/migrations/001_offline.sql', 'utf8'),
      );
      const adapter: SqlDatabase = {
        async select<T>(sql: string, values: SqlValue[] = []) {
          return sqlite.prepare(sql).all(...values) as T[];
        },
        async execute(sql, values = []) {
          sqlite.prepare(sql).run(...values);
        },
        async transaction(statements) {
          sqlite.exec('BEGIN IMMEDIATE');
          try {
            for (const s of statements)
              sqlite.prepare(s.sql).run(...(s.values ?? []));
            sqlite.exec('COMMIT');
          } catch (error) {
            sqlite.exec('ROLLBACK');
            throw error;
          }
        },
      };
      return new LocalStore(adapter);
    }
    try {
      await app.listen(0, '127.0.0.1');
      const url = await app.getUrl();
      let loseResponse = true;
      const api = createApi(url, async (input, init) => {
        const hasPending = (await (input as Request).clone().json())
          .pendingMovements?.length;
        const response = await fetch(input, init);
        if (loseResponse && hasPending) {
          loseResponse = false;
          throw new TypeError('response lost after remote commit');
        }
        return response;
      });
      const a = localStore(),
        b = localStore();
      const sessions = devices.map((d) => ({
        role: 'OPERADOR' as const,
        farmId,
        farmNome: 'Test',
        nome: d.nomeOperador,
        deviceId: d.id,
        deviceToken: d.deviceToken,
      }));
      const first = new SyncCoordinator(a, api.sync),
        otherClient = new SyncCoordinator(b, api.sync);
      await first.run(sessions[0]);
      await otherClient.run(sessions[1]);
      await a.recordMovement(sessions[0], {
        productId,
        tipo: 'SAIDA',
        quantidade: 70,
        dataMovimento: '2026-10-01T12:00:00Z',
      });
      await b.recordMovement(sessions[1], {
        productId,
        tipo: 'SAIDA',
        quantidade: 50,
        dataMovimento: '2026-10-01T12:00:00Z',
      });
      await expect(first.run(sessions[0])).rejects.toThrow('response lost');
      expect(await a.pending(farmId)).toHaveLength(1);
      await otherClient.run(sessions[1]);
      const result = await first.run(sessions[0]);
      await otherClient.run(sessions[1]);
      expect(result.divergences).toContainEqual(
        expect.objectContaining({ productId, saldo: -20 }),
      );
      expect((await a.snapshot(farmId)).movements).toEqual(
        (await b.snapshot(farmId)).movements,
      );
      expect((await a.snapshot(farmId)).movements).toHaveLength(3);
      expect(await a.pending(farmId)).toEqual([]);
      expect(await b.pending(farmId)).toEqual([]);
      expect(await db.syncReceipt.count()).toBe(2);
      await a.recordMovement(sessions[0], {
        productId,
        tipo: 'ENTRADA',
        quantidade: 1,
        dataMovimento: '2026-10-01T12:00:00Z',
      });
      await db.device.update({
        where: { id: devices[0].id },
        data: { ativo: false },
      });
      await expect(first.run(sessions[0])).rejects.toMatchObject({
        status: 401,
      });
      expect(await a.pending(farmId)).toHaveLength(1);
      expect(await db.stockMovement.count()).toBe(3);
    } finally {
      await app.close();
      for (const sqlite of locals) sqlite.close();
    }
  });
  it('persists an individual receipt and never updates an accepted movement on retry', async () => {
    const item = movement();
    const first = await service.syncData(payload([item]), identity);
    expect(first.results).toEqual([
      expect.objectContaining({
        id: item.id,
        status: 'ACCEPTED',
        movement: expect.objectContaining({ responsavel: 'Ana' }),
      }),
    ]);
    const retry = await service.syncData(payload([item]), identity);
    expect(retry.results).toEqual(first.results);
    const conflict = await service.syncData(
      payload([{ ...item, quantidade: 9 }]),
      identity,
    );
    expect(conflict.results[0].status).toBe('ID_PAYLOAD_CONFLICT');
    expect(await db.stockMovement.count()).toBe(1);
    expect(
      Number(
        (await db.stockMovement.findUniqueOrThrow({ where: { id: item.id } }))
          .quantidade,
      ),
    ).toBe(5);
    expect(await db.syncReceipt.count()).toBe(1);
  });
  it('serializes concurrent copies of the same request across independent connections', async () => {
    const otherService = new SyncService(second as never);
    const item = movement();
    const results = await Promise.all([
      service.syncData(payload([item]), identity),
      otherService.syncData(payload([item]), identity),
    ]);
    expect(
      results.every((result) => result.results[0].status === 'ACCEPTED'),
    ).toBe(true);
    expect(await db.stockMovement.count()).toBe(1);
    expect(await db.syncReceipt.count()).toBe(1);
  });
  it('keeps independent physical withdrawals and reports a deficit instead of dropping facts', async () => {
    await db.stockMovement.create({
      data: {
        ...movement({ tipo: 'ENTRADA', quantidade: 100 }),
        dataMovimento: new Date('2026-10-01'),
      },
    });
    await Promise.all([
      service.syncData(payload([movement({ quantidade: 70 })]), identity),
      new SyncService(second as never).syncData(
        payload([movement({ quantidade: 50 })]),
        other,
      ),
    ]);
    const snapshot = await service.syncData(payload(), identity);
    expect(snapshot.newMovements).toHaveLength(3);
    expect(snapshot.divergences).toContainEqual(
      expect.objectContaining({ productId, saldo: -20 }),
    );
  });
  it('does not deduplicate legitimate equal movements just because they share date and quantity', async () => {
    await service.syncData(payload([movement()]), identity);
    await service.syncData(payload([movement()]), other);
    expect(await db.stockMovement.count()).toBe(2);
  });
  it('rejects cross-farm access and products outside the authenticated farm', async () => {
    await expect(
      service.syncData({ ...payload(), farmId: randomUUID() }, identity),
    ).rejects.toThrow();
    const foreign = movement({ productId: randomUUID() });
    expect(
      (await service.syncData(payload([foreign]), identity)).results[0].status,
    ).toBe('VALIDATION_REJECTED');
    expect(await db.stockMovement.count()).toBe(0);
  });
  it.each([0, -1, NaN, Infinity, null, undefined, '5'])(
    'persists a stable validation rejection for quantity %s without changing stock',
    async (quantidade) => {
      const item = movement({ quantidade });
      const result = await service.syncData(payload([item]), identity);
      expect(result.results[0].status).toBe('VALIDATION_REJECTED');
      expect(
        (await service.syncData(payload([item]), identity)).results,
      ).toEqual(result.results);
      expect(await db.stockMovement.count()).toBe(0);
    },
  );
  it('supports an empty download and rejects malformed/duplicate batch identities', async () => {
    expect((await service.syncData(payload(), identity)).results).toEqual([]);
    const item = movement();
    await expect(
      service.syncData(payload([item, item]), identity),
    ).rejects.toThrow();
    await expect(
      service.syncData(
        { ...payload(), pendingMovements: null } as never,
        identity,
      ),
    ).rejects.toThrow();
    await expect(
      service.syncData(payload([movement({ id: '' })]), identity),
    ).rejects.toThrow();
  });
  it.each([null, undefined, 'invalid', '2026-02-30T12:00:00Z'])(
    'rejects an invalid calendar date %s without changing stock',
    async (dataMovimento) => {
      const result = await service.syncData(
        payload([movement({ dataMovimento })]),
        identity,
      );
      expect(result.results[0].status).toBe('VALIDATION_REJECTED');
      expect(await db.stockMovement.count()).toBe(0);
    },
  );
  it('rolls back the entire batch when a later receipt persistence fails', async () => {
    await db.$executeRawUnsafe(
      "CREATE FUNCTION fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.\"movementId\" = 'fail-second' THEN RAISE EXCEPTION 'receipt write failed'; END IF; RETURN NEW; END $$",
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_receipt BEFORE INSERT ON sync_receipts FOR EACH ROW EXECUTE FUNCTION fail_receipt()',
    );
    try {
      await expect(
        service.syncData(
          payload([movement(), movement({ id: 'fail-second' })]),
          identity,
        ),
      ).rejects.toThrow();
      expect(await db.stockMovement.count()).toBe(0);
      expect(await db.syncReceipt.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_receipt ON sync_receipts');
      await db.$executeRawUnsafe('DROP FUNCTION fail_receipt()');
    }
  });
});
