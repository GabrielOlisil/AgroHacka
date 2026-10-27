import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getOfficialSeedDataset } from '../src/stock/official-seed.data';
import { loadDemoFarm } from '../src/stock/demo-load';

// No DATABASE_URL or real application database is read. This suite owns its
// loopback-only container from start to stop, like sync.postgres.integration.ts.
const container = `agrohacka-demo-load-test-${process.pid}`;
let owned = false;
let db: PrismaClient;

const psql = (input: string) =>
  execFileSync(
    'docker',
    ['exec', '-i', container, 'psql', '-U', 'demo_test', '-d', 'demo_test', '-v', 'ON_ERROR_STOP=1'],
    { input },
  );

beforeAll(async () => {
  execFileSync('docker', [
    'run', '--detach', '--rm', '--name', container,
    '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=demo_test',
    '--env', 'POSTGRES_PASSWORD=demo_test',
    '--env', 'POSTGRES_DB=demo_test',
    'postgres:16-alpine',
  ]);
  owned = true;
  const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' })
    .trim()
    .split(':')
    .at(-1);
  if (!port || !/^\d+$/.test(port)) throw new Error('Invalid isolated test port');
  db = new PrismaClient({
    datasources: { db: { url: `postgresql://demo_test:demo_test@127.0.0.1:${port}/demo_test` } },
  });
  for (let attempt = 0; ; attempt++) {
    try {
      await db.$queryRaw`SELECT 1`;
      break;
    } catch (error) {
      if (attempt >= 40) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  psql(
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty',
        '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
      { encoding: 'utf8' },
    ),
  );
});

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE farms, users CASCADE');
});

afterAll(async () => {
  await db?.$disconnect();
  if (owned) execFileSync('docker', ['stop', container], { stdio: 'ignore' });
});

const createOtherFarm = async () => {
  const farm = await db.farm.create({ data: { nome: 'Fazenda de outro gestor', gestorId: 'x' } });
  await db.user.create({
    data: { nome: 'Outro', email: 'outro@fazenda.com', senhaHash: 'h', role: 'GESTOR', farmId: farm.id },
  });
  await db.product.create({
    data: { farmId: farm.id, nome: 'Milho', categoria: 'Sementes', unidadeMedida: 'sc' },
  });
  return farm;
};

describe('loadDemoFarm em PostgreSQL descartável (tarefa 10.1)', () => {
  it('carrega a fazenda de demonstração inteira e devolve o relatório', async () => {
    const dataset = getOfficialSeedDataset();
    const result = await loadDemoFarm(db, dataset);

    expect(result.status).toBe('CRIADA');
    expect(result.relatorio.produtos.validos).toBe(dataset.products.length);
    const farm = await db.farm.findUniqueOrThrow({ where: { id: result.farmId! } });
    const gestor = await db.user.findUniqueOrThrow({ where: { email: dataset.gestor.email } });
    expect(farm.gestorId).toBe(gestor.id);
    expect(gestor.farmId).toBe(farm.id);
    expect(gestor.senhaHash).not.toBe(dataset.gestor.senhaPura);
    expect(await db.device.count({ where: { farmId: farm.id } })).toBe(dataset.devices.length);
    expect(await db.product.count({ where: { farmId: farm.id } })).toBe(dataset.products.length);
    expect(await db.stockMovement.count({ where: { farmId: farm.id } })).toBe(dataset.movements.length);
  });

  it('não apaga nem altera dados de outras fazendas', async () => {
    const other = await createOtherFarm();
    await loadDemoFarm(db, getOfficialSeedDataset());
    expect(await db.farm.findUnique({ where: { id: other.id } })).not.toBeNull();
    expect(await db.product.count({ where: { farmId: other.id } })).toBe(1);
    expect(await db.user.count({ where: { email: 'outro@fazenda.com' } })).toBe(1);
  });

  it('não faz nada quando o gestor de demonstração já existe', async () => {
    const dataset = getOfficialSeedDataset();
    const first = await loadDemoFarm(db, dataset);
    await db.stockMovement.deleteMany({ where: { farmId: first.farmId! } });

    const second = await loadDemoFarm(db, dataset);
    expect(second).toMatchObject({ status: 'JA_EXISTE', farmId: first.farmId });
    expect(await db.farm.count()).toBe(1);
    expect(await db.stockMovement.count()).toBe(0);
  });

  it('não grava linhas rejeitadas', async () => {
    const dataset = getOfficialSeedDataset();
    dataset.movements.push({ ...dataset.movements[0], quantidade: 0 });
    const result = await loadDemoFarm(db, dataset);
    expect(result.relatorio.movimentacoes.rejeitadas).toHaveLength(1);
    expect(await db.stockMovement.count()).toBe(dataset.movements.length - 1);
  });

  it('é atômica: se uma gravação falha, nada da fazenda de demonstração fica no banco', async () => {
    const other = await createOtherFarm();
    const dataset = getOfficialSeedDataset();
    await db.device.create({
      data: { farmId: other.id, nomeOperador: 'Já existe', deviceToken: 'tok_outro', pairingCode: dataset.devices[1].pairingCode },
    });

    await expect(loadDemoFarm(db, dataset)).rejects.toThrow();
    expect(await db.user.count({ where: { email: dataset.gestor.email } })).toBe(0);
    expect(await db.farm.count()).toBe(1);
    expect(await db.product.count()).toBe(1);
  });
});
