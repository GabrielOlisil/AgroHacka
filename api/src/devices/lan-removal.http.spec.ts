import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { SyncController } from '../sync/sync.controller';
import { SyncService } from '../sync/sync.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

// Tarefa 5.7-B: a API sincroniza somente pela internet. Sem rotas de IP local,
// sem IP/porta no pareamento e na conexão; QR e código manual continuam valendo.
describe('API sem LAN: rotas, pareamento e contrato (tarefa 5.7-B)', () => {
  let app: INestApplication;
  const farm = { id: 'farm-a', nome: 'Fazenda A', localIp: '192.168.1.100', localPort: 3333 };
  const device = {
    id: 'dev-1',
    farmId: 'farm-a',
    nomeOperador: 'Carlos',
    deviceToken: 'tok_existente',
    pairingCode: 'AGRO-1234',
    ativo: true,
    farm,
  };
  const prisma = {
    farm: { findUnique: async () => farm, update: async () => farm },
    device: {
      create: async () => device,
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        where.deviceToken === device.deviceToken || where.pairingCode === device.pairingCode ? device : null,
    },
  };

  beforeAll(async () => {
    // Vite does not emit constructor parameter metadata like the Nest compiler.
    Reflect.defineMetadata('design:paramtypes', [PrismaService], DevicesService);
    Reflect.defineMetadata('design:paramtypes', [DevicesService, AuthService], DevicesController);
    Reflect.defineMetadata('design:paramtypes', [SyncService, AuthService], SyncController);
    const module = await Test.createTestingModule({
      controllers: [DevicesController, SyncController],
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SyncService, useValue: {} },
        {
          provide: AuthService,
          useValue: { authenticateSync: async () => ({ role: 'GESTOR', farmId: 'farm-a' }) },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /devices/local-ip e PUT /sync/heartbeat não existem mais', async () => {
    await request(app.getHttpServer())
      .post('/devices/local-ip')
      .set('Authorization', 'Bearer manager')
      .send({ farmId: 'farm-a', localIp: '192.168.1.50' })
      .expect(404);
    await request(app.getHttpServer())
      .put('/sync/heartbeat')
      .set('Authorization', 'Bearer manager')
      .send({ farmId: 'farm-a', localIp: '192.168.1.50' })
      .expect(404);
  });

  it('o QR do pareamento não carrega IP nem porta, mesmo com colunas antigas preenchidas', async () => {
    const res = await request(app.getHttpServer())
      .post('/devices/pairing-token')
      .set('Authorization', 'Bearer manager')
      .send({ farmId: 'farm-a', nomeOperador: 'Carlos' })
      .expect(201);
    expect(res.body.qrPayload).toMatchObject({ farmId: 'farm-a', nomeOperador: 'Carlos' });
    expect(res.body.qrPayload.deviceToken).toMatch(/^tok_/);
    expect(res.body.qrPayload).not.toHaveProperty('localIp');
    expect(res.body.qrPayload).not.toHaveProperty('localPort');
  });

  it('a conexão por token (QR) e por código manual segue funcionando, sem IP nem porta', async () => {
    for (const tokenOrCode of ['tok_existente', 'agro-1234']) {
      const res = await request(app.getHttpServer())
        .post('/devices/connect')
        .send({ tokenOrCode })
        .expect(200);
      expect(res.body).toMatchObject({ sucesso: true, deviceToken: 'tok_existente', farmId: 'farm-a' });
      expect(res.body).not.toHaveProperty('localIp');
      expect(res.body).not.toHaveProperty('localPort');
    }
  });

  it('o documento OpenAPI não publica as rotas removidas', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    expect(Object.keys(document.paths)).not.toContain('/devices/local-ip');
    expect(Object.keys(document.paths)).not.toContain('/sync/heartbeat');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/devices/pairing-token', '/devices/connect', '/sync']),
    );
  });
});
