import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService: normalização do WhatsApp', () => {
  let prisma: any;
  let service: AuthService;
  const farm = { id: 'farm-1', nome: 'Fazenda' };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }) => ({
          id: 'u1',
          nome: data.nome,
          email: data.email,
          role: 'GESTOR',
          telefone: data.telefone ?? null,
          farm,
        })),
        update: vi.fn(async ({ data }) => ({ id: 'u1', telefone: data.telefone })),
      },
      farm: { create: vi.fn().mockResolvedValue(farm) },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    service = new AuthService(prisma as PrismaService);
  });

  const registerDto = (telefone?: string) => ({
    nome: 'Gestor',
    email: 'g@fazenda.com',
    senha: 'senhaSegura123',
    nomeFazenda: 'Fazenda',
    ...(telefone === undefined ? {} : { telefone }),
  });

  describe('register', () => {
    it('grava o WhatsApp em formato canônico, mesmo digitado com espaços e hífens', async () => {
      const result = await service.register(registerDto('+55 69 99999-9999'));

      expect(prisma.user.create.mock.calls[0][0].data.telefone).toBe(
        '+5569999999999',
      );
      expect(result.user.telefone).toBe('+5569999999999');
    });

    it.each([undefined, '', '   '])(
      'cadastra sem WhatsApp quando o campo vem vazio (%j)',
      async (vazio) => {
        const result = await service.register(registerDto(vazio));

        expect(prisma.user.create.mock.calls[0][0].data.telefone).toBeUndefined();
        expect(result.user).not.toHaveProperty('telefone');
      },
    );

    it('recusa WhatsApp inválido antes de tocar no banco', async () => {
      await expect(service.register(registerDto('abc'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('updateTelefone', () => {
    it('salva o número em formato canônico e o devolve', async () => {
      const result = await service.updateTelefone('u1', '+55 (69) 99999-9999');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { telefone: '+5569999999999' },
      });
      expect(result).toEqual({ telefone: '+5569999999999' });
    });

    it.each([null, undefined, '', '   '])(
      'desativa os alertas quando o número vem vazio (%j)',
      async (vazio) => {
        const result = await service.updateTelefone('u1', vazio as never);

        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: 'u1' },
          data: { telefone: null },
        });
        expect(result).toEqual({});
      },
    );

    it('recusa número inválido sem alterar o cadastro', async () => {
      await expect(service.updateTelefone('u1', '12345')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe('AuthController.updateTelefone', () => {
  let service: { authenticateSync: any; updateTelefone: any };
  let controller: AuthController;
  beforeEach(() => {
    service = {
      authenticateSync: vi
        .fn()
        .mockResolvedValue({ actorId: 'u1', farmId: 'f', role: 'GESTOR' }),
      updateTelefone: vi.fn().mockResolvedValue({ telefone: '+5569999999999' }),
    };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('autentica o gestor e atualiza o número dele', async () => {
    const result = await controller.updateTelefone(
      { telefone: '+55 69 99999-9999' },
      'Bearer gestor',
    );

    expect(service.authenticateSync).toHaveBeenCalledWith('Bearer gestor');
    expect(service.updateTelefone).toHaveBeenCalledWith('u1', '+55 69 99999-9999');
    expect(result).toEqual({ telefone: '+5569999999999' });
  });

  it('recusa operador sem alterar nada', async () => {
    service.authenticateSync.mockResolvedValue({ actorId: 'd1', role: 'OPERADOR' });

    await expect(
      controller.updateTelefone({ telefone: '+5569999999999' }, 'Bearer x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.updateTelefone).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'Bearer invalido'])(
    'propaga 401 quando a credencial é ausente ou inválida (%j)',
    async (authorization) => {
      service.authenticateSync.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.updateTelefone(
          { telefone: '+5569999999999' },
          authorization as string | undefined,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(service.updateTelefone).not.toHaveBeenCalled();
    },
  );
});

describe('PATCH /auth/telefone: fronteiras de acesso HTTP', () => {
  let app: INestApplication;
  const service = { authenticateSync: vi.fn(), updateTelefone: vi.fn() };

  beforeAll(async () => {
    // Vite does not emit constructor parameter metadata like the Nest compiler.
    Reflect.defineMetadata('design:paramtypes', [AuthService], AuthController);
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  beforeEach(() => {
    service.authenticateSync.mockReset().mockImplementation(async (header?: string) => {
      if (header === 'Bearer manager')
        return { actorId: 'u1', farmId: 'farm-a', role: 'GESTOR' };
      if (header === 'Bearer operator')
        return { actorId: 'd1', farmId: 'farm-a', role: 'OPERADOR' };
      throw new UnauthorizedException();
    });
    service.updateTelefone
      .mockReset()
      .mockResolvedValue({ telefone: '+5569999999999' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('exige credencial', async () => {
    await request(app.getHttpServer())
      .patch('/auth/telefone')
      .send({ telefone: '+5569999999999' })
      .expect(401);
    expect(service.updateTelefone).not.toHaveBeenCalled();
  });

  it('recusa operador', async () => {
    await request(app.getHttpServer())
      .patch('/auth/telefone')
      .set('Authorization', 'Bearer operator')
      .send({ telefone: '+5569999999999' })
      .expect(403);
    expect(service.updateTelefone).not.toHaveBeenCalled();
  });

  it('o gestor altera o próprio número', async () => {
    const res = await request(app.getHttpServer())
      .patch('/auth/telefone')
      .set('Authorization', 'Bearer manager')
      .send({ telefone: '+55 69 99999-9999' })
      .expect(200);
    expect(service.updateTelefone).toHaveBeenCalledWith('u1', '+55 69 99999-9999');
    expect(res.body).toEqual({ telefone: '+5569999999999' });
  });

  it('devolve 400 com a orientação quando o número é inválido', async () => {
    service.updateTelefone.mockRejectedValue(
      new BadRequestException('Informe o WhatsApp com o código do país.'),
    );
    const res = await request(app.getHttpServer())
      .patch('/auth/telefone')
      .set('Authorization', 'Bearer manager')
      .send({ telefone: 'abc' })
      .expect(400);
    expect(res.body.message).toContain('código do país');
  });
});
