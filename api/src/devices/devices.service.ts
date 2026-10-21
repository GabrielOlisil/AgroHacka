import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';

export interface CreatePairingDto {
  farmId: string;
  nomeOperador: string;
}

export interface ConnectDeviceDto {
  tokenOrCode: string;
}

export interface UpdateLocalIpDto {
  farmId: string;
  localIp: string;
  localPort?: number;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

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
      localIp: farm.localIp,
      localPort: farm.localPort || 3333,
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
      localIp: device.farm.localIp,
      localPort: device.farm.localPort || 3333,
    };
  }

  async updateLocalIp(dto: UpdateLocalIpDto) {
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new NotFoundException('Fazenda não encontrada');
    }

    const port = dto.localPort ?? 3333;
    const updated = await this.prisma.farm.update({
      where: { id: dto.farmId },
      data: {
        localIp: dto.localIp,
        localPort: port,
      },
    });

    return {
      sucesso: true,
      farmId: updated.id,
      localIp: updated.localIp,
      localPort: updated.localPort,
    };
  }
}
