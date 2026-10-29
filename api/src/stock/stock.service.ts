import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertType, UrgencyLevel } from '@prisma/client';
import { analyzeStockInventory, StockInventoryAlert } from '../stock-engine/stock-engine';

// Persisted alert types managed by the reanalysis. PARADO/EXCESSO are informative
// and stay only in the analysis; other types (e.g. OUTRO) are never touched here.
const PERSISTED_TYPES: Partial<Record<StockInventoryAlert['tipo'], AlertType>> = {
  FALTA: AlertType.ESTOQUE_CRITICO,
  VENCIMENTO: AlertType.RISCO_VENCIMENTO,
  ANOMALIA: AlertType.CONSUMO_ANOMALO,
};
const MANAGED_TYPES = new Set<AlertType>(Object.values(PERSISTED_TYPES));

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async analyzeStock(farmId: string, now: Date = new Date()) {
    const products = await this.prisma.product.findMany({
      where: { farmId, ativo: true, excluidoEm: null },
      include: { movements: true },
    });

    return analyzeStockInventory(
      products.map(({ movements: _movements, ...product }) => product),
      products.flatMap((product) => product.movements),
      now,
    );
  }

  async reanalyzeAndPersistAlerts(farmId: string, now: Date = new Date()) {
    const analysis = await this.analyzeStock(farmId, now);

    const criticalAlerts = analysis.alerts.filter(
      (a) => (a.nivel === 'URGENTE' || a.nivel === 'ATENCAO') && PERSISTED_TYPES[a.tipo],
    );

    const existingAlerts = await this.prisma.alert.findMany({
      where: {
        farmId,
        resolvido: false,
      },
    });
    const existingByKey = new Map(existingAlerts.map((e) => [`${e.productId}-${e.tipo}`, e]));
    const currentKeys = new Set<string>();

    for (const alert of criticalAlerts) {
      const tipo = PERSISTED_TYPES[alert.tipo]!;
      const nivelUrgencia = alert.nivel === 'URGENTE' ? UrgencyLevel.ALTA : UrgencyLevel.MEDIA;
      const key = `${alert.productId}-${tipo}`;
      currentKeys.add(key);

      const existing = existingByKey.get(key);
      if (!existing) {
        await this.prisma.alert.create({
          data: {
            farmId,
            productId: alert.productId,
            tipo,
            nivelUrgencia,
            justificativa: alert.justificativa,
            resolvido: false,
            notificadoWhatsapp: false,
          },
        });
      } else if (existing.nivelUrgencia !== nivelUrgencia) {
        // A level change (e.g. ATENÇÃO -> URGENTE) must be notifiable again.
        await this.prisma.alert.update({
          where: { id: existing.id },
          data: { nivelUrgencia, justificativa: alert.justificativa, notificadoWhatsapp: false },
        });
      }
    }

    // The situation no longer exists: resolve, keeping the history.
    const resolvedIds = existingAlerts
      .filter((e) => e.productId && MANAGED_TYPES.has(e.tipo) && !currentKeys.has(`${e.productId}-${e.tipo}`))
      .map((e) => e.id);
    if (resolvedIds.length > 0) {
      await this.prisma.alert.updateMany({
        where: { id: { in: resolvedIds } },
        data: { resolvido: true },
      });
    }

    let notificacoesResult: any = null;
    if (this.notificationsService) {
      notificacoesResult = await this.notificationsService.dispatchCriticalAlerts(farmId);
    }

    return {
      analise: analysis,
      alertas: criticalAlerts,
      notificacoes: notificacoesResult,
    };
  }
}
