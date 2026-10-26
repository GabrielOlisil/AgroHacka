import 'reflect-metadata';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AuthService } from '../auth/auth.service';

describe('pairing recovery HTTP access boundaries', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const devices = [
      {
        id: 'a',
        farmId: 'farm-a',
        nomeOperador: 'Ana',
        ativo: true,
        pairingCode: 'AGRO-AAAA',
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
      {
        id: 'b',
        farmId: 'farm-b',
        nomeOperador: 'Bruno',
        ativo: true,
        pairingCode: 'AGRO-BBBB',
        createdAt: new Date('2026-10-01T12:00:00Z'),
      },
    ];
    // Vite does not emit constructor parameter metadata like the Nest compiler.
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
          useValue: new DevicesService({
            device: {
              findMany: async ({ where }: { where: { farmId: string } }) =>
                devices.filter((d) => d.farmId === where.farmId),
            },
          } as never),
        },
        {
          provide: AuthService,
          useValue: {
            authenticateSync: async (header?: string) => {
              if (header === 'Bearer manager')
                return { role: 'GESTOR', farmId: 'farm-a' };
              if (header === 'Bearer operator')
                return { role: 'OPERADOR', farmId: 'farm-a' };
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
  it('returns only the manager farm codes and marks the response as no-store', async () => {
    const result = await request(app.getHttpServer())
      .get('/devices?farmId=farm-b')
      .set('Authorization', 'Bearer manager')
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.farmId).toBe('farm-a');
    expect(result.body.operators).toHaveLength(1);
    expect(result.body.operators[0].pairingCode).toBe('AGRO-AAAA');
    expect(JSON.stringify(result.body)).not.toContain('AGRO-BBBB');
  });
  it('rejects unauthenticated and operator requests without exposing codes', async () => {
    await request(app.getHttpServer()).get('/devices').expect(401);
    const result = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', 'Bearer operator')
      .expect(403);
    expect(JSON.stringify(result.body)).not.toContain('AGRO-AAAA');
  });
});
