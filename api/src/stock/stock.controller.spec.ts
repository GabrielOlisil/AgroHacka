import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { AuthService } from '../auth/auth.service';

describe('POST /stock/analyze: análise autorizada (tarefa 10.2)', () => {
  let app: INestApplication;
  const stockService = { analyzeStock: vi.fn() };
  const authenticateSync = vi.fn(async (header?: string, deviceToken?: string) => {
    if (header && deviceToken) throw new UnauthorizedException();
    if (header === 'Bearer manager') return { role: 'GESTOR', farmId: 'farm-a' };
    if (deviceToken === 'tok-operator') return { role: 'OPERADOR', farmId: 'farm-a' };
    throw new UnauthorizedException();
  });

  beforeAll(async () => {
    // Vite does not emit constructor parameter metadata like the Nest compiler.
    Reflect.defineMetadata('design:paramtypes', [StockService, AuthService], StockController);
    const module = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        { provide: StockService, useValue: stockService },
        { provide: AuthService, useValue: { authenticateSync } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  beforeEach(() => {
    stockService.analyzeStock.mockReset().mockResolvedValue({ alertas: [] });
    authenticateSync.mockClear();
  });

  afterAll(async () => {
    await app?.close();
  });

  const analyze = () => request(app.getHttpServer()).post('/stock/analyze');

  it('recusa sem credencial', async () => {
    await analyze().send({ farmId: 'farm-a' }).expect(401);
    expect(stockService.analyzeStock).not.toHaveBeenCalled();
  });

  it('recusa token inválido', async () => {
    await analyze().set('Authorization', 'Bearer forjado').send({ farmId: 'farm-a' }).expect(401);
    expect(stockService.analyzeStock).not.toHaveBeenCalled();
  });

  it('recusa as duas credenciais juntas', async () => {
    await analyze()
      .set('Authorization', 'Bearer manager')
      .set('x-device-token', 'tok-operator')
      .send({})
      .expect(401);
    expect(stockService.analyzeStock).not.toHaveBeenCalled();
  });

  it('o gestor analisa a própria fazenda', async () => {
    const res = await analyze().set('Authorization', 'Bearer manager').send({ farmId: 'farm-a' }).expect(200);
    expect(res.body).toEqual({ alertas: [] });
    expect(stockService.analyzeStock).toHaveBeenCalledWith('farm-a');
  });

  it('sem farmId no body, usa a fazenda da identidade', async () => {
    await analyze().set('Authorization', 'Bearer manager').send({}).expect(200);
    expect(stockService.analyzeStock).toHaveBeenCalledWith('farm-a');
  });

  it('recusa farmId forjado de outra fazenda', async () => {
    await analyze().set('Authorization', 'Bearer manager').send({ farmId: 'farm-b' }).expect(403);
    await analyze().set('x-device-token', 'tok-operator').send({ farmId: 'farm-b' }).expect(403);
    expect(stockService.analyzeStock).not.toHaveBeenCalled();
  });

  it('recusa farmId que não é texto', async () => {
    await analyze().set('Authorization', 'Bearer manager').send({ farmId: ['farm-a'] }).expect(403);
    await analyze().set('Authorization', 'Bearer manager').send({ farmId: 123 }).expect(403);
    expect(stockService.analyzeStock).not.toHaveBeenCalled();
  });

  it('o operador ativo consulta a análise da própria fazenda, como no app', async () => {
    await analyze().set('x-device-token', 'tok-operator').send({}).expect(200);
    expect(authenticateSync).toHaveBeenCalledWith(undefined, 'tok-operator');
    expect(stockService.analyzeStock).toHaveBeenCalledWith('farm-a');
  });
});
