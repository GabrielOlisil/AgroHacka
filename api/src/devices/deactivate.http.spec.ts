import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

// O gestor desativa um operador pareado da própria fazenda; o aparelho passa a
// receber 401 na sincronização (AuthService.authenticateSync já recusa inativos).
describe('POST /devices/:id/deactivate', () => {
  let app: INestApplication;
  const createdAt = new Date('2026-10-01T12:00:00Z');
  const devices = new Map<string, { id: string; farmId: string; nomeOperador: string; ativo: boolean; pairingCode: string; createdAt: Date }>();
  const prisma = {
    device: {
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; farmId: string }; data: { ativo: boolean } }) => {
        const device = devices.get(where.id);
        if (!device || device.farmId !== where.farmId) return { count: 0 };
        device.ativo = data.ativo;
        return { count: 1 };
      }),
      findMany: vi.fn(async ({ where }: { where: { farmId: string } }) =>
        [...devices.values()].filter((d) => d.farmId === where.farmId),
      ),
    },
  };

  beforeAll(async () => {
    // Vite does not emit constructor parameter metadata like the Nest compiler.
    Reflect.defineMetadata('design:paramtypes', [PrismaService], DevicesService);
    Reflect.defineMetadata('design:paramtypes', [DevicesService, AuthService], DevicesController);
    const module = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuthService,
          useValue: {
            authenticateSync: async (header?: string) => {
              if (header === 'Bearer manager-a') return { role: 'GESTOR', farmId: 'farm-a' };
              if (header === 'Bearer operator-a') return { role: 'OPERADOR', farmId: 'farm-a' };
              throw new UnauthorizedException();
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  beforeEach(() => {
    devices.clear();
    devices.set('ana', { id: 'ana', farmId: 'farm-a', nomeOperador: 'Ana', ativo: true, pairingCode: 'AGRO-1234', createdAt });
    devices.set('bia', { id: 'bia', farmId: 'farm-b', nomeOperador: 'Bia', ativo: true, pairingCode: 'AGRO-5678', createdAt });
    prisma.device.updateMany.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  const deactivate = (id: string) => request(app.getHttpServer()).post(`/devices/${id}/deactivate`);

  it('recusa sem credencial', async () => {
    await deactivate('ana').expect(401);
    expect(devices.get('ana')!.ativo).toBe(true);
  });

  it('recusa operador', async () => {
    await deactivate('ana').set('Authorization', 'Bearer operator-a').expect(403);
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
  });

  it('o gestor desativa o operador da própria fazenda e recebe a lista sem o código', async () => {
    const res = await deactivate('ana').set('Authorization', 'Bearer manager-a').expect(200);
    expect(devices.get('ana')!.ativo).toBe(false);
    expect(res.body).toEqual({
      farmId: 'farm-a',
      operators: [
        { id: 'ana', farmId: 'farm-a', nomeOperador: 'Ana', ativo: false, pairingCode: null, createdAt: createdAt.toISOString() },
      ],
    });
  });

  it('aparelho de outra fazenda ou inexistente responde 404 e não muda nada', async () => {
    await deactivate('bia').set('Authorization', 'Bearer manager-a').expect(404);
    await deactivate('nao-existe').set('Authorization', 'Bearer manager-a').expect(404);
    expect(devices.get('bia')!.ativo).toBe(true);
  });

  it('o contrato OpenAPI publica a rota com o cabeçalho do gestor', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    const operation = document.paths['/devices/{id}/deactivate']?.post;
    expect(operation).toBeDefined();
    expect(operation!.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'authorization', in: 'header', required: true })]),
    );
  });
});
