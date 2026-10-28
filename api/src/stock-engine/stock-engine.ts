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
  tipo: 'FALTA' | 'VENCIMENTO' | 'ANOMALIA' | 'CRESCENTE' | 'PARADO' | 'EXCESSO';
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

const iso = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value).toISOString();
// Alert texts are read by farmers: Brazilian decimals, no thousands dots.
// Same helpers and texts as client/src/offline/analysis.ts (parity.spec.ts).
const num = (value: number, digits = 2) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits, useGrouping: false });
const brDate = (isoDate: string) => isoDate.slice(0, 10).split('-').reverse().join('/');
// Within a level: shortage stops the work first, expiry is a certain loss (tarefa 12.6).
const TYPE_ORDER = { FALTA: 0, VENCIMENTO: 1, ANOMALIA: 2, CRESCENTE: 3, PARADO: 4, EXCESSO: 5 };
const LEVEL_ORDER = { URGENTE: 0, ATENCAO: 1, INFORMATIVO: 2 };

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
  // Sort keys per alert id, lower first: [type, severity, -stock value].
  const severity = new Map<string, number[]>();
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

    const value = p.precoAquisicao === null ? null : Math.max(0, saldo) * p.precoAquisicao;
    const add = (
      tipo: StockInventoryAlert['tipo'],
      nivel: StockInventoryAlert['nivel'],
      justificativa: string,
      acao: string,
      gravidade = 0,
    ) => {
      severity.set(`${tipo}:${p.id}`, [TYPE_ORDER[tipo], gravidade, -(value ?? -1)]);
      alerts.push({
        id: `${tipo}:${p.id}`,
        productId: p.id,
        tipo,
        nivel,
        titulo: `${p.nome} · ${tipo === 'FALTA' ? 'Reposição' : tipo === 'VENCIMENTO' ? 'Validade' : tipo === 'ANOMALIA' ? 'Consumo fora do padrão' : tipo === 'CRESCENTE' ? 'Consumo crescente' : tipo === 'PARADO' ? 'Estoque parado' : 'Excesso'}`,
        justificativa:
          justificativa +
          (tipo === 'FALTA' || tipo === 'VENCIMENTO' || tipo === 'EXCESSO' ? limitedEvidence : '') +
          ` O que fazer: ${acao}`,
      });
    };
    // Buy enough for 30 days of use, never below the minimum (tarefa 12.5).
    const restock = () => {
      const amount = Math.ceil(Math.max(p.estoqueMinimo, rate * 30) - Math.max(0, saldo) - 1e-9);
      if (amount <= 0) return 'repor antes da próxima retirada, porque o saldo está no mínimo.';
      const cost = p.precoAquisicao === null ? '' : ` (cerca de R$ ${num(amount * p.precoAquisicao)})`;
      return `comprar cerca de ${num(amount)} ${p.unidadeMedida}${cost} para ${rate > 0 && rate * 30 >= p.estoqueMinimo ? '30 dias de uso' : 'voltar ao mínimo'}.`;
    };

    if (saldo <= p.estoqueMinimo)
      add(
        'FALTA',
        'URGENTE',
        `${saldo <= 0 ? `Estoque zerado: restam ${num(saldo)} ${p.unidadeMedida}` : `Restam ${num(saldo)} ${p.unidadeMedida}, no mínimo ou abaixo do mínimo de ${num(p.estoqueMinimo)} ${p.unidadeMedida}`}. ${rate === 0 ? 'Sem retiradas recentes para calcular quanto tempo dura.' : `Com o uso médio de ${num(rate)} ${p.unidadeMedida} por dia (últimos ${days} dias), dura cerca de ${num(daysLeft ?? 0, 1)} dia(s).`}`,
        restock(),
        daysLeft ?? Infinity,
      );
    else if (daysLeft !== null && daysLeft <= 15)
      add(
        'FALTA',
        daysLeft <= 7 ? 'URGENTE' : 'ATENCAO',
        `Com o uso médio de ${num(rate)} ${p.unidadeMedida} por dia (últimos ${days} dias, contando os dias sem retirada), o estoque dura cerca de ${num(daysLeft, 1)} dia(s).`,
        restock(),
        daysLeft,
      );

    if (p.validade && saldo > 0) {
      const remaining = Math.round((Date.parse(p.validade.slice(0, 10)) - today) / DAY);
      const surplus = Math.max(0, saldo - Math.max(0, remaining) * rate);
      // Larger value left over first; unknown price after the priced ones.
      const loss = (quantity: number) => (p.precoAquisicao === null ? 1 : -quantity * p.precoAquisicao);
      if (remaining < 0)
        add(
          'VENCIMENTO',
          'URGENTE',
          `Venceu em ${brDate(p.validade)}, há ${Math.abs(remaining)} dia(s). Ainda há ${num(saldo)} ${p.unidadeMedida} em estoque.`,
          'separar o produto vencido e confirmar com o responsável técnico antes de usar ou descartar.',
          loss(saldo),
        );
      else if (remaining <= 30 && surplus > 0)
        add(
          'VENCIMENTO',
          remaining === 0 ? 'URGENTE' : 'ATENCAO',
          `Vence ${remaining === 0 ? 'hoje' : `em ${remaining} dia(s)`}; no ritmo de uso atual (${num(rate)} ${p.unidadeMedida} por dia), devem sobrar cerca de ${num(surplus)} ${p.unidadeMedida} sem uso.${rate === 0 ? ' Não houve retiradas recentes, então a previsão é incerta.' : ''}`,
          'usar este produto primeiro e não repetir a compra nesse volume.',
          loss(surplus),
        );
    }

    // Every withdrawal with at least 3 before it in the window, against the mean of
    // those before it; the alert points to the largest multiple (tarefa 12.7).
    let peak: { quantity: number; date: string; mean: number; count: number } | undefined;
    for (let i = 3; i < out.length; i++) {
      const mean = out.slice(0, i).reduce((sum, m) => sum + m.quantidade, 0) / i;
      const quantity = out[i].quantidade;
      if (mean > 0 && quantity >= mean * 3 && (!peak || quantity / mean >= peak.quantity / peak.mean))
        peak = { quantity, date: out[i].dataMovimento, mean, count: i };
    }
    if (peak)
      add(
        'ANOMALIA',
        'ATENCAO',
        `Retirada de ${num(peak.quantity)} ${p.unidadeMedida} em ${brDate(peak.date)}, ${num(peak.quantity / peak.mean, 1)} vezes a média das ${peak.count} retiradas anteriores (${num(peak.mean)} ${p.unidadeMedida}). Consideramos fora do padrão a partir de 3 vezes a média.`,
        'conferir com quem retirou se a quantidade está certa.',
        -peak.quantity / peak.mean,
      );
    // Growing use: last 15 days against the 15 before, per day. The earlier half
    // counts from its first withdrawal, so a product that just started is not "growing".
    const split = today - 14 * DAY;
    const recentOut = out.filter((m) => Date.parse(m.dataMovimento.slice(0, 10)) >= split);
    const earlierOut = out.filter((m) => Date.parse(m.dataMovimento.slice(0, 10)) < split);
    if (earlierOut.length >= 2 && recentOut.length >= 2) {
      const earlierDays = Math.round((split - Date.parse(earlierOut[0].dataMovimento.slice(0, 10))) / DAY);
      const earlierRate = earlierOut.reduce((sum, m) => sum + m.quantidade, 0) / earlierDays;
      const recentRate = recentOut.reduce((sum, m) => sum + m.quantidade, 0) / 15;
      if (earlierRate > 0 && recentRate >= earlierRate * 1.5)
        add(
          'CRESCENTE',
          'ATENCAO',
          `O uso médio subiu de ${num(earlierRate)} ${p.unidadeMedida} por dia para ${num(recentRate)} ${p.unidadeMedida} por dia nos últimos 15 dias, ${num(Math.round((recentRate / earlierRate - 1) * 100), 0)}% a mais que nos 15 dias anteriores. Consideramos crescente a partir de 50% a mais.`,
          'conferir se o aumento era esperado e antecipar a próxima compra se ele continuar.',
          -recentRate / earlierRate,
        );
    }

    const lastOut = history.filter((m) => m.tipo === 'SAIDA').slice(-1)[0];
    const firstEntry = history.find((m) => m.tipo === 'ENTRADA');
    if (saldo > 0 && firstEntry && today - Date.parse((lastOut ?? firstEntry).dataMovimento.slice(0, 10)) >= 30 * DAY)
      add(
        'PARADO',
        'INFORMATIVO',
        'Há saldo, mas nenhuma retirada nos últimos 30 dias.',
        'não comprar mais até voltar a ter saída.',
      );

    if (daysLeft !== null && daysLeft > 90)
      add(
        'EXCESSO',
        'INFORMATIVO',
        `Há estoque para cerca de ${num(daysLeft, 0)} dias no ritmo atual, mais de 90 dias. Considere a época do ano antes de decidir.`,
        'não comprar mais até o estoque baixar.',
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

  const bySeverity = (a: StockInventoryAlert, b: StockInventoryAlert) => {
    const ka = severity.get(a.id)!;
    const kb = severity.get(b.id)!;
    for (let i = 0; i < ka.length; i++) {
      // Infinity - Infinity is NaN: treat as a tie.
      const diff = ka[i] - kb[i];
      if (diff) return diff;
    }
    return 0;
  };
  alerts.sort((a, b) => LEVEL_ORDER[a.nivel] - LEVEL_ORDER[b.nivel] || bySeverity(a, b) || a.id.localeCompare(b.id));

  return {
    products: result,
    alerts,
    totalValue,
    pricedProductCount,
    unpricedProductCount,
    balancesByUnit,
  };
}

