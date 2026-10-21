import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertType, UrgencyLevel } from '@prisma/client';
import {
  calculateRunoutTime,
  checkExpiryRisk,
  detectConsumptionAnomalies,
  calculateAbcCurve,
  prioritizeAlerts,
  AlertInput,
} from '../stock-engine/stock-engine';

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}


  async analyzeStock(farmId: string) {
    // 1. Busca todos os produtos da fazenda com suas movimentações
    const products = await this.prisma.product.findMany({
      where: { farmId },
      include: {
        movements: {
          orderBy: { dataMovimento: 'asc' },
        },
      },
    });

    const alertsToCreate: AlertInput[] = [];
    const productsWithBalances: any[] = [];

    let saldoTotalGeral = 0;

    for (const product of products) {
      // Calcula saldo atual a partir do histórico de entradas e saídas
      let saldo = 0;
      const saidas: { quantidade: number; data: Date }[] = [];

      for (const mov of product.movements) {
        if (mov.tipo === 'ENTRADA') {
          saldo += mov.quantidade;
        } else if (mov.tipo === 'SAIDA') {
          saldo -= mov.quantidade;
          saidas.push({ quantidade: mov.quantidade, data: mov.dataMovimento });
        }
      }

      saldoTotalGeral += saldo;

      // 2. Análise de Runout Time (Risco de Falta e Autonomia)
      const runout = calculateRunoutTime(saldo, product.estoqueMinimo, saidas);
      if (runout.status === 'CRITICO') {
        alertsToCreate.push({
          id: `alert-runout-${product.id}`,
          nivel: 'URGENTE',
          titulo: `Estoque Crítico: ${product.nome}`,
          justificativa: runout.justificativa,
        });
      } else if (runout.status === 'ATENCAO') {
        alertsToCreate.push({
          id: `alert-runout-${product.id}`,
          nivel: 'ATENCAO',
          titulo: `Atenção de Estoque: ${product.nome}`,
          justificativa: runout.justificativa,
        });
      }

      // 3. Análise de Risco de Vencimento
      const expiry = checkExpiryRisk(saldo, runout.consumoMedioDiario, product.validade);
      if (expiry.temRisco) {
        alertsToCreate.push({
          id: `alert-expiry-${product.id}`,
          nivel: expiry.jaVenceu ? 'URGENTE' : 'ATENCAO',
          titulo: expiry.jaVenceu ? `Insumo Vencido: ${product.nome}` : `Risco de Vencimento: ${product.nome}`,
          justificativa: expiry.justificativa,
        });
      }

      // 4. Detecção de Anomalias na última saída registrada
      if (saidas.length >= 4) {
        const ultimaSaida = saidas[saidas.length - 1];
        const historicoAnterior = saidas.slice(0, saidas.length - 1).map((s) => s.quantidade);
        const anomaly = detectConsumptionAnomalies(ultimaSaida.quantidade, historicoAnterior);

        if (anomaly.isAnomaly) {
          alertsToCreate.push({
            id: `alert-anomaly-${product.id}`,
            nivel: 'ATENCAO',
            titulo: `Saída Fora do Padrão: ${product.nome}`,
            justificativa: anomaly.justificativa,
          });
        }
      }

      productsWithBalances.push({
        id: product.id,
        nome: product.nome,
        categoria: product.categoria,
        unidadeMedida: product.unidadeMedida,
        saldo,
        estoqueMinimo: product.estoqueMinimo,
        preco: product.precoAquisicao,
        validade: product.validade,
        runout,
      });
    }

    // 5. Curva ABC de capital imobilizado
    const curvaAbc = calculateAbcCurve(
      productsWithBalances.map((p) => ({
        id: p.id,
        nome: p.nome,
        saldo: p.saldo,
        preco: p.preco,
      })),
    );

    // 6. Alertas priorizados
    const alertasPriorizados = prioritizeAlerts(alertsToCreate);

    return {
      resumo: {
        totalInsumos: products.length,
        saldoTotal: saldoTotalGeral,
        totalFinanceiroEstoque: curvaAbc.totalEstoqueFinanceiro,
        totalAlertas: alertasPriorizados.length,
      },
      curvaAbc,
      alertas: alertasPriorizados,
      produtos: productsWithBalances,
    };
  }

  async reanalyzeAndPersistAlerts(farmId: string) {
    const analysis = await this.analyzeStock(farmId);

    const criticalAlerts = analysis.alertas.filter(
      (a) => a.nivel === 'URGENTE' || a.nivel === 'ATENCAO',
    );

    const existingAlerts = await this.prisma.alert.findMany({
      where: {
        farmId,
        resolvido: false,
      },
    });

    const existingKeys = new Set(
      existingAlerts.map((e) => `${e.productId}-${e.tipo}`),
    );

    for (const alert of criticalAlerts) {
      const productId = alert.id.replace(/^(alert-runout-|alert-expiry-|alert-anomaly-)/, '');
      let tipo: AlertType = AlertType.ESTOQUE_CRITICO;
      if (alert.id.startsWith('alert-expiry-')) {
        tipo = AlertType.RISCO_VENCIMENTO;
      } else if (alert.id.startsWith('alert-anomaly-')) {
        tipo = AlertType.CONSUMO_ANOMALO;
      }

      const key = `${productId}-${tipo}`;
      if (!existingKeys.has(key)) {
        await this.prisma.alert.create({
          data: {
            farmId,
            productId,
            tipo,
            nivelUrgencia: alert.nivel === 'URGENTE' ? UrgencyLevel.ALTA : UrgencyLevel.MEDIA,
            justificativa: alert.justificativa || 'Alerta gerado pela análise de estoque.',
            resolvido: false,
            notificadoWhatsapp: false,

          },
        });
        existingKeys.add(key);
      }
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

