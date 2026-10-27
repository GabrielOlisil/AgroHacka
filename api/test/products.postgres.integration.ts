import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ProductsService } from '../src/products/products.service';
import { SyncService } from '../src/sync/sync.service';
import { DevicesService } from '../src/devices/devices.service';
import { AuthService } from '../src/auth/auth.service';

// This suite never reads DATABASE_URL. It exclusively owns a disposable container
// on a random loopback port, with no mounts or connection to application data.
const container = `agrohacka-products-test-${process.pid}`;
let owned = false;
let db: PrismaClient;
let second: PrismaClient;
let observer: PrismaClient;
const identity = {
  actorId: randomUUID(),
  farmId: randomUUID(),
  role: 'GESTOR' as const,
  nome: 'Ana',
};
const foreign = { ...identity, farmId: randomUUID() };
const input = () => ({
  id: randomUUID(),
  nome: 'Adubo',
  categoria: 'Personalizada 🌱',
  unidadeMedida: 'kg',
  estoqueMinimo: 0,
  precoAquisicao: null,
  validade: '2028-02-29',
  lote: 'A',
  fornecedor: 'José',
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
    'POSTGRES_USER=products_test',
    '--env',
    'POSTGRES_PASSWORD=products_test',
    '--env',
    'POSTGRES_DB=products_test',
    'postgres:16-alpine',
  ]);
  owned = true;
  const port = execFileSync('docker', ['port', container, '5432/tcp'], {
    encoding: 'utf8',
  })
    .trim()
    .split(':')
    .at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error('Invalid isolated port');
  const url = `postgresql://products_test:products_test@127.0.0.1:${port}/products_test`;
  db = new PrismaClient({ datasources: { db: { url } } });
  second = new PrismaClient({ datasources: { db: { url } } });
  observer = new PrismaClient({ datasources: { db: { url } } });
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
      'products_test',
      '-d',
      'products_test',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: schema },
  );
}, 90000);

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE farms CASCADE');
  for (const actor of [identity, foreign])
    await db.farm.create({
      data: {
        id: actor.farmId,
        nome: 'Disposable products test',
        gestorId: actor.actorId,
      },
    });
});

afterAll(async () => {
  await Promise.all([
    db?.$disconnect(),
    second?.$disconnect(),
    observer?.$disconnect(),
  ]);
  if (owned) execFileSync('docker', ['stop', container], { stdio: 'ignore' });
});

describe('Product creation on real PostgreSQL', () => {
  it('serializes the same UUID across independent connections, preserving timestamps on lost-response retry', async () => {
    const dto = input();
    const a = new ProductsService(db as never),
      b = new ProductsService(second as never);
    const [first, concurrent] = await Promise.all([
      a.create(dto, identity),
      b.create(dto, identity),
    ]);
    expect(concurrent).toEqual(first);
    expect(await b.create(dto, identity)).toEqual(first);
    expect(await db.product.count()).toBe(1);
    expect(await db.stockMovement.count()).toBe(0);
  });

  it('returns one canonical success and one conflict for concurrent different payloads', async () => {
    const dto = input();
    const results = await Promise.allSettled([
      new ProductsService(db as never).create(dto, identity),
      new ProductsService(second as never).create(
        { ...dto, estoqueMinimo: 5 },
        identity,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { status: 409 },
    });
    expect(await db.product.count()).toBe(1);
  });

  it('arbitrates simultaneous cross-farm UUID collisions without revealing the winning product', async () => {
    const dto = input();
    const results = await Promise.allSettled([
      new ProductsService(db as never).create(dto, identity),
      new ProductsService(second as never).create(
        { ...dto, nome: 'Foreign secret' },
        foreign,
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { status: 409 } });
    if (rejected?.status === 'rejected')
      expect(JSON.stringify(rejected.reason.getResponse())).not.toMatch(
        /Foreign|Adubo|farmId/,
      );
    expect(await db.product.count()).toBe(1);
  });

  it('waits on the same farm lock used by sync and exposes only the committed product in the existing download', async () => {
    let release!: () => void;
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = db.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
          identity.farmId,
        );
        locked();
        await hold;
      },
      { timeout: 20000 },
    );
    await acquired;
    const dto = input();
    const creation = new ProductsService(second as never).create(dto, identity);
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await observer.$queryRaw<
          { waiting: boolean }[]
        >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM farms WHERE id = $1 FOR UPDATE%') AS waiting`;
        if (rows[0]?.waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      expect(await observer.product.count()).toBe(0);
    } finally {
      release();
    }
    await blocker;
    const canonical = await creation;
    const download = await new SyncService(observer as never).syncData(
      { farmId: identity.farmId, protocolVersion: 2 },
      identity,
    );
    const { createdAt: _createdAt, ...syncProduct } = canonical;
    expect(download.newProducts).toContainEqual(
      expect.objectContaining(syncProduct),
    );
    expect(download.newMovements).toEqual([]);
    const foreignDownload = await new SyncService(observer as never).syncData(
      { farmId: foreign.farmId },
      foreign,
    );
    expect(foreignDownload.newProducts).toEqual([]);
  });

  it('leaves no product after a database write failure and permits retry with the original UUID', async () => {
    await db.$executeRawUnsafe(
      "CREATE FUNCTION fail_product() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected write failure'; END $$",
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER fail_product BEFORE INSERT ON products FOR EACH ROW EXECUTE FUNCTION fail_product()',
    );
    const service = new ProductsService(db as never),
      dto = input();
    try {
      await expect(service.create(dto, identity)).rejects.toThrow();
      expect(await db.product.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_product ON products');
      await db.$executeRawUnsafe('DROP FUNCTION fail_product()');
    }
    expect((await service.create(dto, identity)).id).toBe(dto.id);
    expect(await db.stockMovement.count()).toBe(0);
  });
});

describe('Operator removal on real PostgreSQL without movement FK', () => {
  async function device() {
    return db.device.create({
      data: {
        farmId: identity.farmId,
        nomeOperador: 'Bruno',
        deviceToken: randomUUID(),
        pairingCode: randomUUID(),
      },
    });
  }
  it('keeps historical names, receipts and balances after rename and hard deletion', async () => {
    const d = await device();
    const p = await new ProductsService(db as never).create(input(), identity);
    const auth = new AuthService(db as never);
    const operator = await auth.authenticateSync(undefined, d.deviceToken);
    const movement = {
      id: randomUUID(),
      farmId: identity.farmId,
      productId: p.id,
      tipo: 'ENTRADA' as const,
      quantidade: 10,
      dataMovimento: '2026-10-27T12:00:00.000Z',
      responsavel: 'forged',
    };
    const sync = new SyncService(db as never);
    await sync.syncData(
      { farmId: identity.farmId, pendingMovements: [movement] },
      operator,
    );
    const before = await db.stockMovement.findMany();
    const receipts = await db.syncReceipt.findMany();
    const admin = new DevicesService(second as never);
    await admin.updateOperator(identity.farmId, d.id, {
      nomeOperador: 'Nome novo',
    });
    expect((await auth.authenticateSync(undefined, d.deviceToken)).nome).toBe(
      'Nome novo',
    );
    await admin.deleteOperator(identity.farmId, d.id);
    await admin.deleteOperator(identity.farmId, d.id);
    expect(await db.device.count()).toBe(0);
    expect(await db.stockMovement.findMany()).toEqual(before);
    expect(await db.syncReceipt.findMany()).toEqual(receipts);
    const managerSnapshot = await sync.syncData(
      { farmId: identity.farmId, pendingMovements: [] },
      identity,
    );
    expect(managerSnapshot.newMovements).toMatchObject([
      { responsavel: 'Bruno', quantidade: 10 },
    ]);
    await expect(
      auth.authenticateSync(undefined, d.deviceToken),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('isolates foreign devices and supports disabling and reactivating without rotating credentials', async () => {
    const d = await device();
    const admin = new DevicesService(db as never);
    await admin.deleteOperator(foreign.farmId, d.id);
    await expect(
      admin.updateOperator(foreign.farmId, d.id, { nomeOperador: 'Forged' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await db.device.findUnique({ where: { id: d.id } })).toEqual(d);
    await admin.updateOperator(identity.farmId, d.id, { ativo: false });
    await expect(
      new AuthService(db as never).authenticateSync(undefined, d.deviceToken),
    ).rejects.toMatchObject({ status: 401 });
    await admin.updateOperator(identity.farmId, d.id, { ativo: true });
    expect(
      (await admin.listOperators(identity.farmId)).operators[0]?.pairingCode,
    ).toBe(d.pairingCode);
    expect(
      (
        await new AuthService(db as never).authenticateSync(
          undefined,
          d.deviceToken,
        )
      ).deviceId,
    ).toBe(d.id);
  });
  it('refuses a device authenticated before deletion while its sync waits for the farm lock', async () => {
    const d = await device();
    const stale = await new AuthService(db as never).authenticateSync(
      undefined,
      d.deviceToken,
    );
    let entered!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deletion = observer.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
          identity.farmId,
        );
        entered();
        await gate;
        await tx.device.deleteMany({
          where: { farmId: identity.farmId, id: d.id },
        });
      },
      { timeout: 15000 },
    );
    await ready;
    const attempted = new SyncService(second as never)
      .syncData({ farmId: identity.farmId, pendingMovements: [] }, stale)
      .catch((error) => error);
    try {
      await expect
        .poll(
          async () => {
            const rows = await db.$queryRawUnsafe<{ count: bigint }[]>(
              "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%SELECT id FROM farms%'",
            );
            return Number(rows[0]?.count);
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(0);
    } finally {
      release();
      await deletion;
    }
    expect(await attempted).toMatchObject({ status: 401 });
    expect(await db.stockMovement.count()).toBe(0);
    expect(await db.syncReceipt.count()).toBe(0);
  });
});
