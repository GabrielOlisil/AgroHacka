import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, StockMovement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SyncIdentity } from '../auth/auth.service';
import {
  HeartbeatDto,
  SyncMovementDto,
  SyncPayloadDto,
  SyncReceiptDto,
  SyncResponseDto,
} from './dto/sync.dto';

function serialize(m: StockMovement): SyncMovementDto {
  return {
    id: m.id,
    farmId: m.farmId,
    productId: m.productId,
    tipo: m.tipo,
    quantidade: m.quantidade,
    dataMovimento: m.dataMovimento.toISOString(),
    responsavel: m.responsavel,
    ...(m.destino == null ? {} : { destino: m.destino }),
    updatedAt: m.updatedAt.toISOString(),
  };
}
function content(m: SyncMovementDto) {
  return {
    id: m.id,
    farmId: m.farmId,
    productId: m.productId,
    tipo: m.tipo,
    quantidade: m.quantidade,
    dataMovimento: m.dataMovimento,
    destino: m.destino ?? '',
  };
}
function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function valid(m: SyncMovementDto, identity: SyncIdentity): SyncMovementDto {
  if (
    !m ||
    m.farmId !== identity.farmId ||
    typeof m.productId !== 'string' ||
    !m.productId.trim() ||
    (m.tipo !== 'ENTRADA' && m.tipo !== 'SAIDA') ||
    typeof m.quantidade !== 'number' ||
    !Number.isFinite(m.quantidade) ||
    m.quantidade <= 0 ||
    typeof m.dataMovimento !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(m.dataMovimento) ||
    !Number.isFinite(Date.parse(m.dataMovimento)) ||
    (m.destino != null && typeof m.destino !== 'string')
  )
    throw new Error('Movimentação inválida.');
  const calendar = m.dataMovimento.slice(0, 10);
  if (new Date(calendar).toISOString().slice(0, 10) !== calendar)
    throw new Error('Data inválida.');
  return {
    ...content(m),
    dataMovimento: new Date(m.dataMovimento).toISOString(),
    responsavel: identity.nome,
  };
}

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async updateHeartbeat(dto: HeartbeatDto, identity: SyncIdentity) {
    if (dto.farmId !== identity.farmId || identity.role !== 'GESTOR')
      throw new ForbiddenException();
    const farm = await this.prisma.farm.update({
      where: { id: identity.farmId },
      data: { localIp: dto.localIp, localPort: dto.localPort || 3333 },
    });
    return {
      sucesso: true,
      farmId: farm.id,
      localIp: farm.localIp,
      localPort: farm.localPort,
      updatedAt: farm.updatedAt,
    };
  }

  async syncData(
    dto: SyncPayloadDto,
    identity: SyncIdentity,
  ): Promise<SyncResponseDto> {
    if (
      !identity ||
      !dto ||
      dto.farmId !== identity.farmId ||
      (dto.deviceId && dto.deviceId !== identity.deviceId)
    )
      throw new ForbiddenException('Fazenda ou dispositivo sem autorização.');
    if (dto.protocolVersion !== undefined && dto.protocolVersion !== 2)
      throw new BadRequestException('Versão de sync inválida.');
    const movements =
      dto.pendingMovements === undefined ? [] : dto.pendingMovements;
    if (!Array.isArray(movements) || movements.length > 100)
      throw new BadRequestException('Envie até 100 movimentações por lote.');
    const ids = new Set<string>();
    for (const m of movements) {
      if (
        !m ||
        typeof m.id !== 'string' ||
        !m.id.trim() ||
        m.id.length > 128 ||
        ids.has(m.id)
      )
        throw new BadRequestException(
          'Identificadores ausentes ou repetidos no lote.',
        );
      ids.add(m.id);
    }
    const results = await this.prisma.$transaction(
      async (tx) => {
        // A shared database lock serializes independent API instances. No external
        // I/O occurs while holding the lock; every receipt is committed with its effect.
        const farms = await tx.$queryRawUnsafe<{ id: string }[]>(
          'SELECT id FROM farms WHERE id = $1 FOR UPDATE',
          identity.farmId,
        );
        if (!farms.length) throw new ForbiddenException();
        const receipts: SyncReceiptDto[] = [];
        for (const raw of movements) {
          let movement: SyncMovementDto | undefined;
          try {
            movement = valid(raw, identity);
          } catch {
            /* durable rejection below */
          }
          const payloadHash = hash({
            version: 2,
            actorId: identity.actorId,
            movement: content(movement ?? raw),
          });
          const old = await tx.syncReceipt.findUnique({
            where: {
              farmId_movementId: {
                farmId: identity.farmId,
                movementId: raw.id,
              },
            },
          });
          if (old) {
            receipts.push(
              old.payloadHash === payloadHash
                ? (old.result as unknown as SyncReceiptDto)
                : {
                    id: raw.id,
                    status: 'ID_PAYLOAD_CONFLICT',
                    message:
                      'Identificador já utilizado com outro conteúdo ou autor.',
                  },
            );
            continue;
          }
          const product =
            movement &&
            (await tx.product.findFirst({
              where: { id: movement.productId, farmId: identity.farmId },
            }));
          let result: SyncReceiptDto;
          if (!movement || !product) {
            result = {
              id: raw.id,
              status: 'VALIDATION_REJECTED',
              message:
                'Dados inválidos ou produto indisponível nesta fazenda. Preserve o registro para revisão.',
            };
          } else {
            const existing = await tx.stockMovement.findUnique({
              where: { id: movement.id },
            });
            if (
              existing &&
              (existing.farmId !== identity.farmId ||
                hash(content(serialize(existing))) !== hash(content(movement)))
            ) {
              result = {
                id: raw.id,
                status: 'ID_PAYLOAD_CONFLICT',
                message:
                  'Identificador já utilizado; nenhuma movimentação foi alterada.',
              };
            } else {
              const saved =
                existing ??
                (await tx.stockMovement.create({
                  data: {
                    ...content(movement),
                    responsavel: identity.nome,
                    dataMovimento: new Date(movement.dataMovimento),
                  },
                }));
              result = {
                id: raw.id,
                status: 'ACCEPTED',
                movement: serialize(saved),
              };
            }
          }
          await tx.syncReceipt.create({
            data: {
              farmId: identity.farmId,
              movementId: raw.id,
              actorId: identity.actorId,
              payloadHash,
              result: JSON.parse(
                JSON.stringify(result),
              ) as Prisma.InputJsonValue,
            },
          });
          receipts.push(result);
        }
        await tx.syncLog.create({
          data: {
            farmId: identity.farmId,
            deviceId: identity.deviceId,
            totalRegistros: receipts.filter((r) => r.status === 'ACCEPTED')
              .length,
            tipoSync: 'CLOUD',
          },
        });
        return receipts;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 20000,
      },
    );

    // A timestamp is informational only. Both full tables are read from one
    // consistent snapshot, including catalog changes made outside this endpoint.
    const [products, stored] = await this.prisma.$transaction(
      [
        this.prisma.product.findMany({
          where: { farmId: identity.farmId },
          orderBy: { id: 'asc' },
        }),
        this.prisma.stockMovement.findMany({
          where: { farmId: identity.farmId },
          orderBy: { id: 'asc' },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const balances = new Map<string, Prisma.Decimal>();
    for (const m of stored)
      balances.set(
        m.productId,
        (balances.get(m.productId) ?? new Prisma.Decimal(0)).add(
          new Prisma.Decimal(m.quantidade).mul(m.tipo === 'ENTRADA' ? 1 : -1),
        ),
      );
    return {
      protocolVersion: 2,
      sucesso: true,
      serverTimestamp: new Date().toISOString(),
      syncedCount: results.filter((r) => r.status === 'ACCEPTED').length,
      results,
      newMovements: stored.map(serialize),
      newProducts: products.map((p) => ({
        ...p,
        validade: p.validade?.toISOString() ?? null,
        updatedAt: p.updatedAt.toISOString(),
      })),
      divergences: [...balances]
        .filter(([, saldo]) => saldo.isNegative())
        .map(([productId, saldo]) => ({
          productId,
          saldo: saldo.toNumber(),
          message:
            'Saldo consolidado negativo. Os fatos foram preservados; confira entradas, saídas e possíveis duplicidades.',
        })),
    };
  }
}
