import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService: WhatsApp do gestor na resposta de sessão', () => {
  let authService: AuthService;
  let prisma: any;
  const farm = { id: 'farm-123', nome: 'Fazenda Santa Maria' };

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn(), create: vi.fn() },
      farm: { create: vi.fn().mockResolvedValue(farm) },
      $transaction: vi.fn((callback) => callback(prisma)),
    };
    authService = new AuthService(prisma as PrismaService);
  });

  const userRow = (telefone: string | null | undefined) => ({
    id: 'user-123',
    farmId: farm.id,
    nome: 'Produtor Silva',
    email: 'gestor@fazenda.com',
    senhaHash: 'hash-secreto',
    role: 'GESTOR',
    telefone,
    farm,
  });

  describe('register', () => {
    it('devolve o WhatsApp informado no cadastro', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(userRow('+5569999999999'));

      const result = await authService.register({
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        senha: 'senhaSegura123',
        nomeFazenda: farm.nome,
        telefone: '+5569999999999',
      });

      expect(result.user.telefone).toBe('+5569999999999');
    });

    it.each([null, undefined])(
      'omite o telefone quando o cadastro não informou nenhum (%s)',
      async (semTelefone) => {
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(userRow(semTelefone));

        const result = await authService.register({
          nome: 'Produtor Silva',
          email: 'gestor@fazenda.com',
          senha: 'senhaSegura123',
          nomeFazenda: farm.nome,
        });

        expect(result.user).not.toHaveProperty('telefone');
      },
    );
  });

  describe('login', () => {
    it('devolve o WhatsApp cadastrado do gestor', async () => {
      const bcrypt = await import('bcrypt');
      prisma.user.findUnique.mockResolvedValue({
        ...userRow('+5569999999999'),
        senhaHash: await bcrypt.hash('senhaCorreta123', 4),
      });

      const result = await authService.login({
        email: 'gestor@fazenda.com',
        senha: 'senhaCorreta123',
      });

      expect(result.user.telefone).toBe('+5569999999999');
    });

    it('omite o telefone quando o gestor não cadastrou nenhum (null no banco)', async () => {
      const bcrypt = await import('bcrypt');
      prisma.user.findUnique.mockResolvedValue({
        ...userRow(null),
        senhaHash: await bcrypt.hash('senhaCorreta123', 4),
      });

      const result = await authService.login({
        email: 'gestor@fazenda.com',
        senha: 'senhaCorreta123',
      });

      expect(result.user).not.toHaveProperty('telefone');
    });

    it('nunca expõe o hash da senha na resposta', async () => {
      const bcrypt = await import('bcrypt');
      prisma.user.findUnique.mockResolvedValue({
        ...userRow('+5569999999999'),
        senhaHash: await bcrypt.hash('senhaCorreta123', 4),
      });

      const result = await authService.login({
        email: 'gestor@fazenda.com',
        senha: 'senhaCorreta123',
      });

      expect(JSON.stringify(result.user)).not.toMatch(/hash|\$2[aby]\$/i);
    });
  });
});
