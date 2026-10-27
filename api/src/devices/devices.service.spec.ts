import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DevicesService - Pareamento de Dispositivos', () => {
  let devicesService: DevicesService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      device: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      farm: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    devicesService = new DevicesService(prismaService as PrismaService);
  });

  describe('createPairingToken', () => {
    it('deve gerar token de pareamento e código alfanumérico curto para o operador', async () => {
      const mockFarm = {
        id: 'farm-123',
        nome: 'Fazenda Santa Maria',
        localIp: '192.168.1.100',
        localPort: 3333,
      };

      prismaService.farm.findUnique.mockResolvedValue(mockFarm);

      const mockDevice = {
        id: 'dev-1',
        farmId: 'farm-123',
        nomeOperador: 'Carlos Silva - Tratorista',
        deviceToken: 'tok_random_123',
        pairingCode: 'AGRO-42',
        ativo: true,
      };

      prismaService.device.create.mockResolvedValue(mockDevice);

      const result = await devicesService.createPairingToken({
        farmId: 'farm-123',
        nomeOperador: 'Carlos Silva - Tratorista',
      });

      expect(prismaService.farm.findUnique).toHaveBeenCalledWith({
        where: { id: 'farm-123' },
      });

      expect(result).toHaveProperty('deviceToken');
      expect(result).toHaveProperty('pairingCode');
      expect(result.pairingCode).toMatch(/^AGRO-[A-Z0-9]{4}$/);
      expect(result.qrPayload).toHaveProperty('farmId', 'farm-123');
      expect(result.qrPayload).toHaveProperty(
        'nomeOperador',
        'Carlos Silva - Tratorista',
      );
      expect(result.qrPayload).not.toHaveProperty('localIp');
      expect(result.qrPayload).not.toHaveProperty('localPort');
    });

    it('deve lançar erro se a fazenda não for encontrada', async () => {
      prismaService.farm.findUnique.mockResolvedValue(null);

      await expect(
        devicesService.createPairingToken({
          farmId: 'farm-inexistente',
          nomeOperador: 'Carlos',
        }),
      ).rejects.toThrow('Fazenda não encontrada');
    });
  });

  describe('listOperators', () => {
    it('lists existing devices for one farm without creating or rotating credentials', async () => {
      const createdAt = new Date('2026-10-01T12:00:00Z');
      prismaService.device.findMany.mockResolvedValue([
        {
          id: 'd-1',
          farmId: 'farm-1',
          nomeOperador: 'Ana',
          ativo: true,
          pairingCode: 'AGRO-1234',
          createdAt,
          deviceToken: 'must-not-leak',
        },
        {
          id: 'd-2',
          farmId: 'farm-1',
          nomeOperador: 'Bruno',
          ativo: false,
          pairingCode: 'AGRO-5678',
          createdAt,
          deviceToken: 'must-not-leak',
        },
      ]);
      const result = await devicesService.listOperators('farm-1');
      expect(prismaService.device.findMany).toHaveBeenCalledWith({
        where: { farmId: 'farm-1' },
        select: {
          id: true,
          farmId: true,
          nomeOperador: true,
          ativo: true,
          pairingCode: true,
          createdAt: true,
        },
        orderBy: [{ nomeOperador: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual({
        farmId: 'farm-1',
        operators: [
          {
            id: 'd-1',
            farmId: 'farm-1',
            nomeOperador: 'Ana',
            ativo: true,
            pairingCode: 'AGRO-1234',
            createdAt: createdAt.toISOString(),
          },
          {
            id: 'd-2',
            farmId: 'farm-1',
            nomeOperador: 'Bruno',
            ativo: false,
            pairingCode: null,
            createdAt: createdAt.toISOString(),
          },
        ],
      });
      expect(prismaService.device.create).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain('must-not-leak');
    });
    it('returns an empty list without inventing operator records', async () => {
      prismaService.device.findMany.mockResolvedValue([]);
      expect(await devicesService.listOperators('farm-1')).toEqual({
        farmId: 'farm-1',
        operators: [],
      });
    });
    it.each([null, undefined, '', '   ', 0])(
      'rejects an invalid farm scope %s before querying credentials',
      async (farmId) => {
        await expect(
          devicesService.listOperators(farmId as never),
        ).rejects.toThrow();
        expect(prismaService.device.findMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('connectDevice', () => {
    it('deve conectar com sucesso via deviceToken', async () => {
      const mockDevice = {
        id: 'dev-1',
        farmId: 'farm-123',
        nomeOperador: 'Carlos Silva',
        deviceToken: 'tok_valido',
        pairingCode: 'AGRO-99',
        ativo: true,
        farm: {
          id: 'farm-123',
          nome: 'Fazenda Santa Maria',
          localIp: '192.168.1.100',
          localPort: 3333,
        },
      };

      prismaService.device.findUnique.mockResolvedValue(mockDevice);

      const result = await devicesService.connectDevice({
        tokenOrCode: 'tok_valido',
      });

      expect(result.sucesso).toBe(true);
      expect(result.nomeOperador).toBe('Carlos Silva');
      expect(result.farmId).toBe('farm-123');
      expect(result).not.toHaveProperty('localIp');
      expect(result).not.toHaveProperty('localPort');
    });

    it('deve conectar com sucesso via pairingCode alfanumérico', async () => {
      const mockDevice = {
        id: 'dev-1',
        farmId: 'farm-123',
        nomeOperador: 'Marcos Souza',
        deviceToken: 'tok_qualquer',
        pairingCode: 'AGRO-88',
        ativo: true,
        farm: {
          id: 'farm-123',
          nome: 'Fazenda Boa Esperança',
          localIp: '192.168.1.15',
          localPort: 3333,
        },
      };

      // Simula busca por pairingCode
      prismaService.device.findUnique
        .mockResolvedValueOnce(null) // primeiro busca por token
        .mockResolvedValueOnce(mockDevice); // depois por pairingCode

      const result = await devicesService.connectDevice({
        tokenOrCode: 'AGRO-88',
      });

      expect(result.sucesso).toBe(true);
      expect(result.nomeOperador).toBe('Marcos Souza');
      expect(result.farmNome).toBe('Fazenda Boa Esperança');
      expect(result.deviceToken).toBe('tok_qualquer');
    });

    it('deve rejeitar se o token ou código for inválido', async () => {
      prismaService.device.findUnique.mockResolvedValue(null);

      await expect(
        devicesService.connectDevice({
          tokenOrCode: 'CODIGO_INVALIDO',
        }),
      ).rejects.toThrow('Código ou Token de pareamento inválido');
    });
  });

  it('não oferece mais atualização de IP local (tarefa 5.7-B)', () => {
    expect('updateLocalIp' in devicesService).toBe(false);
  });
});
