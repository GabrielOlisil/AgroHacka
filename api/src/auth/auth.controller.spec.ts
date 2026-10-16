import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: any;

  beforeEach(() => {
    authService = {
      register: vi.fn(),
      login: vi.fn(),
    };

    authController = new AuthController(authService as AuthService);
  });

  it('deve chamar o register do service com os dados corretos', async () => {
    const dto = {
      nome: 'Carlos Gestor',
      email: 'carlos@fazenda.com',
      senha: 'senhaForte123',
      nomeFazenda: 'Fazenda Boa Esperança',
    };

    const mockResponse = {
      accessToken: 'jwt_token',
      user: {
        id: 'u-1',
        nome: 'Carlos Gestor',
        email: 'carlos@fazenda.com',
        role: 'GESTOR',
        farmId: 'f-1',
      },
    };

    authService.register.mockResolvedValue(mockResponse);

    const result = await authController.register(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('deve chamar o login do service com os dados corretos', async () => {
    const dto = {
      email: 'carlos@fazenda.com',
      senha: 'senhaForte123',
    };

    const mockResponse = {
      accessToken: 'jwt_token',
      user: {
        id: 'u-1',
        nome: 'Carlos Gestor',
        email: 'carlos@fazenda.com',
        role: 'GESTOR',
        farmId: 'f-1',
      },
    };

    authService.login.mockResolvedValue(mockResponse);

    const result = await authController.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
