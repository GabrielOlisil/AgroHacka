export interface StockInventoryProduct {
  id: string;
  farmId: string;
  nome: string;
  categoria: string;
  unidadeMedida: string;
  estoqueMinimo: number;
  precoAquisicao?: number | null;
  validade?: string | Date | null;
}

export interface StockInventoryMovement {
  id: string;
  farmId: string;
  productId: string;
  tipo: 'ENTRADA' | 'SAIDA';
  quantidade: number;
  dataMovimento: string | Date;
  responsavel?: string;
}

export interface AnalyzedProductOutput extends StockInventoryProduct {
  saldo: number;
  consumoMedioDiario: number;
  diasRestantes: number | null;
  valorEstoque: number | null;
  classeAbc: 'A' | 'B' | 'C' | null;
  percentualValor: number | null;
  amostrasConsumo: number;
  diasAmostra: number;
  confiabilidade: 'INDISPONIVEL' | 'BAIXA' | 'MEDIA' | 'ALTA';
  consumoDiario: { dia: string; quantidade: number }[];
}

export interface StockInventoryAlert {
  id: string;
  productId: string;
  tipo: 'FALTA' | 'VENCIMENTO' | 'ANOMALIA' | 'PARADO' | 'EXCESSO';
  nivel: 'URGENTE' | 'ATENCAO' | 'INFORMATIVO';
  titulo: string;
  justificativa: string;
}

export interface StockInventoryAnalysis {
  products: AnalyzedProductOutput[];
  alerts: StockInventoryAlert[];
  totalValue: number;
  pricedProductCount: number;
  unpricedProductCount: number;
  balancesByUnit: Record<string, number>;
}

const DAY = 86_400_000;

/**
 * 7. Priorização de Alertas
 */
export function prioritizeAlerts<T extends { nivel: 'URGENTE' | 'ATENCAO' | 'INFORMATIVO'; id?: string }>(alertas: T[]): T[] {
  if (!alertas || alertas.length === 0) return [];

  const pesos = {
    URGENTE: 0,
    ATENCAO: 1,
    INFORMATIVO: 2,
  };

  return [...alertas].sort(
    (a, b) => (pesos[a.nivel] ?? 2) - (pesos[b.nivel] ?? 2) || (a.id && b.id ? a.id.localeCompare(b.id) : 0),
  );
}

const iso = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value).toISOString();
// Alert texts are read by farmers: Brazilian decimals, no thousands dots.
// Same helpers and texts as client/src/offline/analysis.ts (parity.spec.ts).
const num = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits, useGrouping: false });
const brDate = (isoDate: string) => isoDate.slice(0, 10).split('-').reverse().join('/');

/**
 * 8. Análise Integrada de Estoque.
 * Mesma lógica de client/src/offline/analysis.ts (analyzeInventory); a paridade
 * é verificada com as mesmas fixtures em parity.spec.ts. Ao mudar uma regra,
 * mude as duas e mantenha esse teste passando.
 */
export function analyzeStockInventory(
  products: StockInventoryProduct[] | null | undefined,
  movements: StockInventoryMovement[] | null | undefined,
  now: Date = new Date(),
): StockInventoryAnalysis {
  if (!Number.isFinite(now.getTime())) {
    throw new Error('Data de análise inválida.');
  }

  // Prisma entrega Date e o cliente guarda ISO: normaliza para comparar como o cliente.
  const safeProducts = (products ?? []).map((p) => ({
    ...p,
    precoAquisicao: p.precoAquisicao ?? null,
    validade: p.validade ? iso(p.validade) : null,
  }));
  const safeMovements = (movements ?? []).map((m) => ({ ...m, dataMovimento: iso(m.dataMovimento) }));

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const alerts: StockInventoryAlert[] = [];
  const balancesByUnit: Record<string, number> = {};

  const result = safeProducts.map((p): AnalyzedProductOutput => {
    const history = safeMovements
      .filter((m) => m.productId === p.id && m.farmId === p.farmId && Date.parse(m.dataMovimento) <= now.getTime())
      .sort((a, b) => a.dataMovimento.localeCompare(b.dataMovimento));
    const saldo = history.reduce((sum, m) => sum + (m.tipo === 'ENTRADA' ? m.quantidade : -m.quantidade), 0);
    const out = history.filter((m) => m.tipo === 'SAIDA' && Date.parse(m.dataMovimento) >= today - 29 * DAY);
    const firstDay = out[0] ? Date.parse(out[0].dataMovimento.slice(0, 10)) : today;
    const days = Math.max(1, Math.floor((today - firstDay) / DAY) + 1);
    const rate = out.reduce((sum, m) => sum + m.quantidade, 0) / days;
    const daysLeft = rate > 0 ? Math.max(0, saldo) / rate : null;
    const limitedEvidence =
      rate > 0 && out.length < 3
        ? ` Previsão com poucos dados: ${out.length} retirada(s) em ${days} dia(s); pode mudar.`
        : '';

    const add = (tipo: StockInventoryAlert['tipo'], nivel: StockInventoryAlert['nivel'], justificativa: string) =>
      alerts.push({
        id: `${tipo}:${p.id}`,
        productId: p.id,
        tipo,
        nivel,
        titulo: `${p.nome} · ${tipo === 'FALTA' ? 'Reposição' : tipo === 'VENCIMENTO' ? 'Validade' : tipo === 'ANOMALIA' ? 'Consumo fora do padrão' : tipo === 'PARADO' ? 'Estoque parado' : 'Excesso'}`,
        justificativa:
          justificativa + (tipo === 'FALTA' || tipo === 'VENCIMENTO' || tipo === 'EXCESSO' ? limitedEvidence : ''),
      });

    if (saldo <= p.estoqueMinimo)
      add(
        'FALTA',
        'URGENTE',
        `${saldo <= 0 ? `Estoque zerado: restam ${num(saldo)} ${p.unidadeMedida}` : `Restam ${num(saldo)} ${p.unidadeMedida}, no mínimo ou abaixo do mínimo de ${num(p.estoqueMinimo)} ${p.unidadeMedida}`}. ${rate === 0 ? 'Sem retiradas recentes para calcular quanto tempo dura.' : `Com o uso médio de ${num(rate)} ${p.unidadeMedida} por dia (últimos ${days} dias), dura cerca de ${num(daysLeft ?? 0, 1)} dia(s).`}`,
      );
    else if (daysLeft !== null && daysLeft <= 15)
      add(
        'FALTA',
        daysLeft <= 7 ? 'URGENTE' : 'ATENCAO',
        `Com o uso médio de ${num(rate)} ${p.unidadeMedida} por dia (últimos ${days} dias, contando os dias sem retirada), o estoque dura cerca de ${num(daysLeft, 1)} dia(s).`,
      );

    if (p.validade && saldo > 0) {
      const remaining = Math.round((Date.parse(p.validade.slice(0, 10)) - today) / DAY);
      const surplus = Math.max(0, saldo - Math.max(0, remaining) * rate);
      if (remaining < 0)
        add(
          'VENCIMENTO',
          'URGENTE',
          `Venceu em ${brDate(p.validade)}, há ${Math.abs(remaining)} dia(s). Ainda há ${num(saldo)} ${p.unidadeMedida} em estoque.`,
        );
      else if (remaining <= 30 && surplus > 0)
        add(
          'VENCIMENTO',
          remaining === 0 ? 'URGENTE' : 'ATENCAO',
          `Vence ${remaining === 0 ? 'hoje' : `em ${remaining} dia(s)`}; no ritmo de uso atual (${num(rate)} ${p.unidadeMedida} por dia), devem sobrar cerca de ${num(surplus)} ${p.unidadeMedida} sem uso.${rate === 0 ? ' Não houve retiradas recentes, então a previsão é incerta.' : ''}`,
        );
    }

    if (out.length >= 4) {
      const previous = out.slice(0, -1);
      const mean = previous.reduce((sum, m) => sum + m.quantidade, 0) / previous.length;
      const last = out[out.length - 1];
      if (mean > 0 && last.quantidade >= mean * 3)
        add(
          'ANOMALIA',
          'ATENCAO',
          `Retirada de ${num(last.quantidade)} ${p.unidadeMedida}, ${num(last.quantidade / mean, 1)} vezes a média das ${previous.length} retiradas anteriores (${num(mean)} ${p.unidadeMedida}). Consideramos fora do padrão a partir de 3 vezes a média.`,
        );
    }

    const lastOut = history.filter((m) => m.tipo === 'SAIDA').slice(-1)[0];
    const firstEntry = history.find((m) => m.tipo === 'ENTRADA');
    if (saldo > 0 && firstEntry && today - Date.parse((lastOut ?? firstEntry).dataMovimento.slice(0, 10)) >= 30 * DAY)
      add(
        'PARADO',
        'INFORMATIVO',
        'Há saldo, mas nenhuma retirada nos últimos 30 dias. Avalie antes de comprar mais.',
      );

    if (daysLeft !== null && daysLeft > 90)
      add(
        'EXCESSO',
        'INFORMATIVO',
        `Há estoque para cerca de ${num(daysLeft, 0)} dias no ritmo atual, mais de 90 dias. Considere a época do ano antes de decidir.`,
      );

    balancesByUnit[p.unidadeMedida] = (balancesByUnit[p.unidadeMedida] ?? 0) + saldo;

    const daily = new Map<string, number>();
    for (const m of out) daily.set(m.dataMovimento.slice(0, 10), (daily.get(m.dataMovimento.slice(0, 10)) ?? 0) + m.quantidade);

    return {
      ...p,
      saldo,
      consumoMedioDiario: rate,
      diasRestantes: daysLeft,
      amostrasConsumo: out.length,
      diasAmostra: days,
      confiabilidade: rate === 0 ? 'INDISPONIVEL' : out.length >= 5 ? 'ALTA' : out.length >= 3 ? 'MEDIA' : 'BAIXA',
      valorEstoque: p.precoAquisicao === null ? null : Math.max(0, saldo) * p.precoAquisicao,
      classeAbc: p.precoAquisicao === null ? null : 'C',
      percentualValor: p.precoAquisicao === null ? null : 0,
      consumoDiario: Array.from({ length: days }, (_, i) => {
        const dia = new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10);
        return { dia, quantidade: daily.get(dia) ?? 0 };
      }),
    };
  });

  const priced = result.filter((p): p is AnalyzedProductOutput & { valorEstoque: number } => p.valorEstoque !== null);
  const totalValue = priced.reduce((sum, p) => sum + p.valorEstoque, 0);
  const pricedProductCount = priced.filter((p) => p.saldo > 0).length;
  const unpricedProductCount = result.filter((p) => p.saldo > 0 && p.valorEstoque === null).length;
  let cumulative = 0;
  for (const p of [...priced].sort((a, b) => b.valorEstoque - a.valorEstoque || a.id.localeCompare(b.id))) {
    p.percentualValor = totalValue > 0 ? (p.valorEstoque / totalValue) * 100 : 0;
    p.classeAbc = p.valorEstoque <= 0 ? 'C' : cumulative < 80 ? 'A' : cumulative < 95 ? 'B' : 'C';
    cumulative += p.percentualValor;
  }

  return {
    products: result,
    alerts: prioritizeAlerts(alerts),
    totalValue,
    pricedProductCount,
    unpricedProductCount,
    balancesByUnit,
  };
}

