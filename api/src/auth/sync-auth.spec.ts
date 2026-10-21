import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

describe('sync identity', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    device: { findUnique: vi.fn() },
  };
  let auth: AuthService;
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    auth = new AuthService(prisma as never);
  });
  it('rejects absent, malformed and ambiguous credentials', async () => {
    await expect(auth.authenticateSync()).rejects.toThrow();
    await expect(auth.authenticateSync('not bearer')).rejects.toThrow();
    await expect(
      auth.authenticateSync('Bearer invalid', 'device-token'),
    ).rejects.toThrow();
  });
  it('uses the current manager from the database, not name/role from JSON', async () => {
    vi.spyOn(jwt, 'verify').mockReturnValue({
      sub: 'user',
      farmId: 'farm',
    } as never);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user',
      farmId: 'farm',
      role: 'GESTOR',
      nome: 'Ana',
    });
    expect(await auth.authenticateSync('Bearer signed')).toEqual({
      actorId: 'user',
      farmId: 'farm',
      role: 'GESTOR',
      nome: 'Ana',
    });
  });
  it('rejects expired/invalid tokens and users moved to another farm', async () => {
    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('expired');
    });
    await expect(auth.authenticateSync('Bearer expired')).rejects.toThrow();
    vi.spyOn(jwt, 'verify').mockReturnValue({
      sub: 'user',
      farmId: 'old',
    } as never);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user',
      farmId: 'new',
      role: 'GESTOR',
      nome: 'Ana',
    });
    await expect(auth.authenticateSync('Bearer signed')).rejects.toThrow();
  });
  it('accepts only an active device credential', async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: 'device',
      farmId: 'farm',
      nomeOperador: 'Bruno',
      ativo: true,
    });
    expect(await auth.authenticateSync(undefined, 'device-token')).toEqual({
      actorId: 'device',
      deviceId: 'device',
      farmId: 'farm',
      role: 'OPERADOR',
      nome: 'Bruno',
    });
    prisma.device.findUnique.mockResolvedValue({
      id: 'device',
      farmId: 'farm',
      ativo: false,
    });
    await expect(auth.authenticateSync(undefined, 'revoked')).rejects.toThrow();
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(auth.authenticateSync(undefined, 'missing')).rejects.toThrow();
  });
});
