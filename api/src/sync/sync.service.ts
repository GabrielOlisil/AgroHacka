import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';

export interface HeartbeatDto {
  farmId: string;
  localIp: string;
  localPort?: number;
}

export interface SyncMovementDto {
  id: string;
  farmId: string;
  productId: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  dataMovimento: Date | string;
  destino?: string;
  responsavel: string;
  updatedAt?: Date | string;
}

export interface SyncPayloadDto {
  farmId: string;
  deviceId?: string;
  lastSyncTimestamp?: string;
  pendingMovements?: SyncMovementDto[];
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async updateHeartbeat(dto: HeartbeatDto) {
    const port = dto.localPort || 3333;
    const farm = await this.prisma.farm.update({
      where: { id: dto.farmId },
      data: {
        localIp: dto.localIp,
        localPort: port,
      },
    });

    return {
      sucesso: true,
      farmId: farm.id,
      localIp: farm.localIp,
      localPort: farm.localPort,
      updatedAt: farm.updatedAt,
    };
  }

  async syncData(dto: SyncPayloadDto) {
    const movements = dto.pendingMovements || [];

    // 1. Salva/Atualiza movimentações recebidas via upsert para idempotência (evita duplicatas)
    if (movements.length > 0) {
      await Promise.all(
        movements.map((mov) =>
          this.prisma.stockMovement.upsert({
            where: { id: mov.id },
            create: {
              id: mov.id,
              farmId: dto.farmId,
              productId: mov.productId,
              tipo: mov.tipo,
              quantidade: mov.quantidade,
              dataMovimento: new Date(mov.dataMovimento),
              destino: mov.destino,
              responsavel: mov.responsavel,
            },
            update: {
              quantidade: mov.quantidade,
              destino: mov.destino,
              responsavel: mov.responsavel,
              updatedAt: new Date(),
            },
          }),
        ),
      );
    }

    // 2. Busca novidades do servidor após o lastSyncTimestamp
    const lastDate = dto.lastSyncTimestamp ? new Date(dto.lastSyncTimestamp) : new Date(0);

    const newMovements = await this.prisma.stockMovement.findMany({
      where: {
        farmId: dto.farmId,
        updatedAt: { gt: lastDate },
      },
    });

    const newProducts = await this.prisma.product.findMany({
      where: {
        farmId: dto.farmId,
        updatedAt: { gt: lastDate },
      },
    });

    // 3. Executa reanálise centralizada para atualizar os alertas de estoque
    const analysis = await this.stockService.analyzeStock(dto.farmId);

    // 4. Registra log de sincronização
    await this.prisma.syncLog.create({
      data: {
        farmId: dto.farmId,
        deviceId: dto.deviceId,
        totalRegistros: movements.length,
        tipoSync: 'CLOUD',
      },
    });

    return {
      sucesso: true,
      serverTimestamp: new Date().toISOString(),
      syncedCount: movements.length,
      newMovements,
      newProducts,
      alerts: analysis.alertas,
      resumo: analysis.resumo,
    };
  }
}
