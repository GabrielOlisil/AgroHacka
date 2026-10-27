import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'crypto';
import type {
  OperatorsResponseDto,
  UpdateOperatorDto,
  OperatorMutationResponseDto,
} from './dto/devices.dto';

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

  private async manageOperator(
    farmId: string,
    id: string,
    patch?: UpdateOperatorDto,
  ): Promise<OperatorMutationResponseDto> {
    for (const value of [farmId, id]) {
      if (
        typeof value !== 'string' ||
        !value.trim() ||
        value !== value.trim() ||
        value.length > 128
      )
        throw new BadRequestException(
          'Identificador de fazenda/operador inválido.',
        );
    }
    return this.prisma.$transaction(
      async (tx) => {
        const farms = await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
          farmId,
        );
        if (!farms.length) throw new ForbiddenException();
        const where = { farmId, id };
        if (patch) {
          const updated = await tx.device.updateMany({ where, data: patch });
          if (!updated.count)
            throw new NotFoundException(
              'Operador não encontrado nesta fazenda.',
            );
        } else {
          // No relation to movements: the historical name and immutable receipts stay intact.
          await tx.device.deleteMany({ where });
        }
        return { farmId, id, sucesso: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateOperator(
    farmId: string,
    id: string,
    dto: UpdateOperatorDto,
  ): Promise<OperatorMutationResponseDto> {
    if (
      !dto ||
      typeof dto !== 'object' ||
      Array.isArray(dto) ||
      !Object.keys(dto).length ||
      Object.keys(dto).some((key) => key !== 'nomeOperador' && key !== 'ativo')
    )
      throw new BadRequestException('Campos de operador inválidos.');
    const data: UpdateOperatorDto = {};
    if ('nomeOperador' in dto) {
      if (
        typeof dto.nomeOperador !== 'string' ||
        !dto.nomeOperador.trim() ||
        dto.nomeOperador.trim().length > 100
      )
        throw new BadRequestException('Nome do operador inválido.');
      data.nomeOperador = dto.nomeOperador.trim().normalize('NFC');
    }
    if ('ativo' in dto) {
      if (typeof dto.ativo !== 'boolean')
        throw new BadRequestException('Situação do operador inválida.');
      data.ativo = dto.ativo;
    }
    return this.manageOperator(farmId, id, data);
  }

  async deleteOperator(
    farmId: string,
    id: string,
  ): Promise<OperatorMutationResponseDto> {
    return this.manageOperator(farmId, id);
  }

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
