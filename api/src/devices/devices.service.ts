import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';
import type { OperatorsResponseDto } from './dto/devices.dto';

export interface CreatePairingDto {
  farmId: string;
  nomeOperador: string;
}

export interface ConnectDeviceDto {
  tokenOrCode: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listOperators(farmId: string): Promise<OperatorsResponseDto> {
    if (typeof farmId !== 'string' || !farmId.trim())
      throw new BadRequestException(
        'Fazenda obrigatória para consultar operadores.',
      );
    const operators = await this.prisma.device.findMany({
      where: { farmId },
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
    return {
      farmId,
      operators: operators.map((device) => ({
        id: device.id,
        farmId: device.farmId,
        nomeOperador: device.nomeOperador,
        ativo: device.ativo,
        pairingCode: device.ativo ? device.pairingCode : null,
        createdAt: device.createdAt.toISOString(),
      })),
    };
  }

  async createPairingToken(dto: CreatePairingDto) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new NotFoundException('Fazenda não encontrada');
    }

    const deviceToken = `tok_${crypto.randomBytes(16).toString('hex')}`;
    // Código curto legível: ex: AGRO-7X2K
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const pairingCode = `AGRO-${randomSuffix}`;

    await this.prisma.device.create({
      data: {
        farmId: farm.id,
        nomeOperador: dto.nomeOperador,
        deviceToken,
        pairingCode,
        ativo: true,
      },
    });

    const qrPayload = {
      farmId: farm.id,
      farmNome: farm.nome,
      nomeOperador: dto.nomeOperador,
      deviceToken,
    };

    return {
      deviceToken,
      pairingCode,
      qrPayload,
    };
  }

  async connectDevice(dto: ConnectDeviceDto) {
    const code = (dto.tokenOrCode || '').trim();

    // Tenta buscar por token direto
    let device = await this.prisma.device.findUnique({
      where: { deviceToken: code },
      include: { farm: true },
    });

    // Se não encontrou, tenta buscar por código alfanumérico curto
    if (!device) {
      device = await this.prisma.device.findUnique({
        where: { pairingCode: code.toUpperCase() },
        include: { farm: true },
      });
    }

    if (!device || !device.ativo) {
      throw new BadRequestException(
        'Código ou Token de pareamento inválido ou inativo',
      );
    }

    return {
      sucesso: true,
      deviceId: device.id,
      deviceToken: device.deviceToken,
      farmId: device.farmId,
      farmNome: device.farm.nome,
      nomeOperador: device.nomeOperador,
    };
  }
}
