import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      farm: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prismaService)),
    };

    authService = new AuthService(prismaService as PrismaService);
  });

  describe('register', () => {
    it('deve registrar um novo Gestor com senha criptografada e criar a fazenda', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const mockFarm = {
        id: 'farm-123',
        nome: 'Fazenda Santa Maria',
        gestorId: 'user-123',
      };

      const mockUser = {
        id: 'user-123',
        farmId: 'farm-123',
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        senhaHash: 'hashed_password',
        role: 'GESTOR',
        farm: mockFarm,
      };

      prismaService.farm.create.mockResolvedValue(mockFarm);
      prismaService.user.create.mockResolvedValue(mockUser);

      const result = await authService.register({
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        senha: 'senhaSegura123',
        nomeFazenda: 'Fazenda Santa Maria',
      });

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'gestor@fazenda.com' },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result.user).toEqual({
        id: 'user-123',
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        role: 'GESTOR',
        farmId: 'farm-123',
        farmNome: 'Fazenda Santa Maria',
      });
    });

    it('deve lançar erro se o e-mail já estiver cadastrado', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'gestor@fazenda.com',
      });

      await expect(
        authService.register({
          nome: 'Outro Produtor',
          email: 'gestor@fazenda.com',
          senha: 'senhaSegura123',
          nomeFazenda: 'Outra Fazenda',
        }),
      ).rejects.toThrow('E-mail já cadastrado');
    });
  });

  describe('login', () => {
    it('deve autenticar o Gestor com sucesso e retornar token', async () => {
      // Criação de hash simulada
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('senhaCorreta123', 10);

      const mockUser = {
        id: 'user-123',
        farmId: 'farm-123',
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        senhaHash: hash,
        role: 'GESTOR',
        farm: {
          id: 'farm-123',
          nome: 'Fazenda Santa Maria',
        },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'gestor@fazenda.com',
        senha: 'senhaCorreta123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('gestor@fazenda.com');
    });

    it('deve lançar erro se a senha estiver incorreta', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('senhaCorreta123', 10);

      const mockUser = {
        id: 'user-123',
        email: 'gestor@fazenda.com',
        senhaHash: hash,
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'gestor@fazenda.com',
          senha: 'senhaErrada',
        }),
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('deve lançar erro se o usuário não for encontrado', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'inexistente@fazenda.com',
          senha: 'senha123',
        }),
      ).rejects.toThrow('Credenciais inválidas');
    });

    it('deve autenticar o Gestor informando campo password alternativo', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('agro1234', 10);

      const mockUser = {
        id: 'user-123',
        farmId: 'farm-123',
        nome: 'Produtor Silva',
        email: 'gestor@fazenda.com',
        senhaHash: hash,
        role: 'GESTOR',
        farm: {
          id: 'farm-123',
          nome: 'Fazenda Santa Maria',
        },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'gestor@fazenda.com',
        password: 'agro1234',
      } as any);

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe('gestor@fazenda.com');
    });

    it('deve lançar erro se nem senha nem password forem informados', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'gestor@fazenda.com',
        senhaHash: 'hash',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'gestor@fazenda.com',
        } as any),
      ).rejects.toThrow('Credenciais inválidas');
    });
  });
});
