import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthService } from '../auth/auth.service';

describe('notificações WhatsApp: fronteiras de acesso HTTP', () => {
  let app: INestApplication;
  const service = {
    sendTestMessage: vi.fn(),
    dispatchCriticalAlerts: vi.fn(),
  };

  beforeAll(async () => {
    // Vite does not emit constructor parameter metadata like the Nest compiler.
    Reflect.defineMetadata(
      'design:paramtypes',
      [NotificationsService, AuthService],
      NotificationsController,
    );
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
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

  beforeEach(() => {
    service.sendTestMessage.mockReset().mockResolvedValue({ sucesso: true });
    service.dispatchCriticalAlerts
      .mockReset()
      .mockResolvedValue({ totalEnviados: 0 });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('exige credencial para enviar o teste e para disparar os alertas', async () => {
    await request(app.getHttpServer())
      .post('/notifications/test-whatsapp')
      .send({ paraTelefone: '+5569999999999' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/notifications/dispatch-critical')
      .send({ farmId: 'farm-a' })
      .expect(401);
    expect(service.sendTestMessage).not.toHaveBeenCalled();
    expect(service.dispatchCriticalAlerts).not.toHaveBeenCalled();
  });

  it('recusa operador nos dois endpoints', async () => {
    await request(app.getHttpServer())
      .post('/notifications/test-whatsapp')
      .set('Authorization', 'Bearer operator')
      .send({ paraTelefone: '+5569999999999' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/notifications/dispatch-critical')
      .set('Authorization', 'Bearer operator')
      .send({ farmId: 'farm-a' })
      .expect(403);
    expect(service.sendTestMessage).not.toHaveBeenCalled();
    expect(service.dispatchCriticalAlerts).not.toHaveBeenCalled();
  });

  it('o gestor envia o teste e dispara os alertas somente da própria fazenda', async () => {
    await request(app.getHttpServer())
      .post('/notifications/test-whatsapp')
      .set('Authorization', 'Bearer manager')
      .send({ paraTelefone: '+5569999999999', mensagem: 'oi' })
      .expect(200);
    expect(service.sendTestMessage).toHaveBeenCalledWith({
      farmId: 'farm-a',
      paraTelefone: '+5569999999999',
      mensagem: 'oi',
    });

    await request(app.getHttpServer())
      .post('/notifications/dispatch-critical')
      .set('Authorization', 'Bearer manager')
      .send({ farmId: 'farm-a' })
      .expect(200);
    expect(service.dispatchCriticalAlerts).toHaveBeenCalledWith('farm-a');
  });

  it('o gestor não dispara alertas de outra fazenda', async () => {
    await request(app.getHttpServer())
      .post('/notifications/dispatch-critical')
      .set('Authorization', 'Bearer manager')
      .send({ farmId: 'farm-b' })
      .expect(403);
    expect(service.dispatchCriticalAlerts).not.toHaveBeenCalled();
  });
});
