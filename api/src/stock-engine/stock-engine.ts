export interface NormalizedProduct {
  nome: string;
  unidadeMedida: string;
}

export interface RunoutResult {
  diasRestantes: number | null;
  consumoMedioDiario: number;
  diasAmostra?: number;
  status: 'CRITICO' | 'ATENCAO' | 'NORMAL';
  justificativa: string;
  confiabilidade: 'ALTA' | 'MEDIA' | 'BAIXA';
}

export interface ExpiryResult {
  temRisco: boolean;
  diasAteVencimento: number | null;
  sobraEstimada: number;
  jaVenceu: boolean;
  justificativa: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  mediaHistorica: number;
  multiplicador: number;
  justificativa: string;
}

export interface StagnantExcessResult {
  isStagnant: boolean;
  isExcess: boolean;
  justificativaParado?: string;
  justificativaExcesso?: string;
}

export interface AbcProductInput {
  id: string;
  nome: string;
  saldo: number;
  preco: number | null;
}

export interface AbcProductOutput extends AbcProductInput {
  valorTotal: number;
  percentual: number;
  percentualAcumulado: number;
  classe: 'A' | 'B' | 'C';
}

export interface AbcResult {
  totalEstoqueFinanceiro: number;
  produtos: AbcProductOutput[];
}

export interface AlertInput {
  id: string;
  nivel: 'URGENTE' | 'ATENCAO' | 'INFORMATIVO';
  titulo: string;
  justificativa?: string;
}

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
const SIGLAS_AGRO = ['NPK', 'MAP', 'KCL', 'FTE', 'EPI', 'PVC', 'S10', 'DAP'];

/**
 * 1. Normalização de dados (Nomes e unidades)
 */
export function normalizeUnitAndName(nome: string, unidade: string): NormalizedProduct {
  let cleanName = (nome || '').trim().replace(/\s+/g, ' ');

  // Padroniza siglas agrícolas em maiúsculas
  for (const sigla of SIGLAS_AGRO) {
    const regex = new RegExp(`\\b${sigla}\\b`, 'gi');
    cleanName = cleanName.replace(regex, sigla);
  }

  let cleanUnit = (unidade || '').trim().toLowerCase();
  if (!cleanUnit) {
    cleanUnit = 'un';
  }

  return {
    nome: cleanName,
    unidadeMedida: cleanUnit,
  };
}

/**
 * 2. Cálculo de Runout Time (Autonomia e Risco de Falta por dias de calendário)
 */
export function calculateRunoutTime(
  saldoAtual: number,
  estoqueMinimo: number,
  saidas: { quantidade: number; data: Date | string }[],
  now: Date = new Date(),
): RunoutResult {
  const safeSaldo = Math.max(0, saldoAtual);

  if (safeSaldo === 0) {
    return {
      diasRestantes: 0,
      consumoMedioDiario: 0,
      diasAmostra: 0,
      status: 'CRITICO',
      justificativa: 'Estoque zerado! Ação imediata de compra recomendada.',
      confiabilidade: 'ALTA',
    };
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Janela recente de 30 dias de calendário UTC
  const safeSaidas = (saidas || [])
    .map((s) => ({
      quantidade: s.quantidade,
      time: typeof s.data === 'string' ? Date.parse(s.data) : s.data.getTime(),
      dateStr: typeof s.data === 'string' ? s.data : s.data.toISOString(),
    }))
    .filter((s) => Number.isFinite(s.time) && s.time <= now.getTime() && s.time >= today - 29 * DAY)
    .sort((a, b) => a.time - b.time);

  if (safeSaidas.length === 0) {
    return {
      diasRestantes: null,
      consumoMedioDiario: 0,
      diasAmostra: 0,
      status: safeSaldo <= estoqueMinimo ? 'CRITICO' : 'NORMAL',
      justificativa: 'Sem histórico de consumo recente para projetar autonomia.',
      confiabilidade: 'BAIXA',
    };
  }

  const firstDate = new Date(safeSaidas[0].time);
  const firstDay = Date.UTC(
    firstDate.getUTCFullYear(),
    firstDate.getUTCMonth(),
    firstDate.getUTCDate(),
  );

  const days = Math.max(1, Math.floor((today - firstDay) / DAY) + 1);
  const totalConsumido = safeSaidas.reduce((acc, s) => acc + s.quantidade, 0);
  const consumoMedioDiario = totalConsumido / days;

  if (consumoMedioDiario <= 0) {
    return {
      diasRestantes: null,
      consumoMedioDiario: 0,
      diasAmostra: days,
      status: safeSaldo <= estoqueMinimo ? 'CRITICO' : 'NORMAL',
      justificativa: 'Consumo recente nulo ou não registrado.',
      confiabilidade: 'BAIXA',
    };
  }

  const diasRestantes = Math.round(safeSaldo / consumoMedioDiario);
  const confiabilidade = safeSaidas.length >= 5 ? 'ALTA' : safeSaidas.length >= 3 ? 'MEDIA' : 'BAIXA';
  const status =
    diasRestantes <= 7 || safeSaldo <= estoqueMinimo
      ? 'CRITICO'
      : diasRestantes <= 15
        ? 'ATENCAO'
        : 'NORMAL';

  return {
    diasRestantes,
    consumoMedioDiario,
    diasAmostra: days,
    status,
    justificativa: `Mantendo o consumo médio recente de ${consumoMedioDiario.toFixed(1)}/dia (últimos ${days} dias de calendário), o saldo atual será suficiente por aproximadamente ${diasRestantes} dias.`,
    confiabilidade,
  };
}

/**
 * 3. Risco de Vencimento vs. Ritmo de Uso
 */
export function checkExpiryRisk(
  saldoAtual: number,
  consumoMedioDiario: number,
  dataValidade: Date | string | null,
  now: Date = new Date(),
): ExpiryResult {
  if (!dataValidade) {
    return {
      temRisco: false,
      diasAteVencimento: null,
      sobraEstimada: 0,
      jaVenceu: false,
      justificativa: 'Produto sem data de validade informada.',
    };
  }

  const safeSaldo = Math.max(0, saldoAtual);
  if (safeSaldo <= 0) {
    return {
      temRisco: false,
      diasAteVencimento: null,
      sobraEstimada: 0,
      jaVenceu: false,
      justificativa: 'Produto com saldo zerado, sem risco de perda por vencimento.',
    };
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const validadeDate = typeof dataValidade === 'string' ? new Date(dataValidade) : dataValidade;
  const validadeUtc = Date.UTC(
    validadeDate.getUTCFullYear(),
    validadeDate.getUTCMonth(),
    validadeDate.getUTCDate(),
  );

  const diasAteVencimento = Math.round((validadeUtc - today) / DAY);

  if (diasAteVencimento < 0) {
    return {
      temRisco: true,
      diasAteVencimento,
      sobraEstimada: safeSaldo,
      jaVenceu: true,
      justificativa: `Produto já se encontra vencido há ${Math.abs(diasAteVencimento)} dias! Não aplicar no campo sem laudo técnico.`,
    };
  }

  const consumoAteVencimento = diasAteVencimento * Math.max(0, consumoMedioDiario);
  const sobraEstimada = Math.max(0, safeSaldo - consumoAteVencimento);

  if (diasAteVencimento === 0) {
    return {
      temRisco: true,
      diasAteVencimento: 0,
      sobraEstimada,
      jaVenceu: false,
      justificativa: `Produto vence hoje! Sobra estimada de ${sobraEstimada.toFixed(0)} unidades.`,
    };
  }

  if (diasAteVencimento <= 30 && sobraEstimada > 0) {
    return {
      temRisco: true,
      diasAteVencimento,
      sobraEstimada,
      jaVenceu: false,
      justificativa: `Atenção: no ritmo atual de consumo (${consumoMedioDiario.toFixed(1)}/dia), cerca de ${sobraEstimada.toFixed(0)} unidades irão vencer antes de serem utilizadas (vencimento em ${diasAteVencimento} dias).`,
    };
  }

  return {
    temRisco: false,
    diasAteVencimento,
    sobraEstimada: 0,
    jaVenceu: false,
    justificativa: 'Estoque projetado para ser consumido antes do vencimento.',
  };
}

/**
 * 4. Detecção de Anomalias de Consumo
 */
export function detectConsumptionAnomalies(
  saidaAtual: number,
  historico: number[],
): AnomalyResult {
  if (!historico || historico.length < 3) {
    return {
      isAnomaly: false,
      mediaHistorica: historico.length > 0 ? historico[0] : 0,
      multiplicador: 1,
      justificativa: 'Amostras insuficientes para detecção estatística de anomalia.',
    };
  }

  const media = historico.reduce((acc, v) => acc + v, 0) / historico.length;
  if (media <= 0) {
    return {
      isAnomaly: saidaAtual > 0,
      mediaHistorica: 0,
      multiplicador: 0,
      justificativa: 'Retirada em item sem histórico anterior de consumo.',
    };
  }

  const multiplicador = saidaAtual / media;
  const isAnomaly = multiplicador >= 3;

  return {
    isAnomaly,
    mediaHistorica: media,
    multiplicador,
    justificativa: isAnomaly
      ? `Retirada atípica detectada: quantidade ${saidaAtual} é ${multiplicador.toFixed(1)}x superior à média histórica recente (${media.toFixed(1)}).`
      : 'Consumo dentro do desvio padrão esperado.',
  };
}

/**
 * 5. Detecção de Estoque Parado e Excesso
 */
export function checkStagnantAndExcess(
  saldoAtual: number,
  diasRestantes: number | null,
  ultimaSaida: Date | string | null,
  primeiraEntrada: Date | string | null,
  now: Date = new Date(),
): StagnantExcessResult {
  const safeSaldo = Math.max(0, saldoAtual);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  let isStagnant = false;
  let justificativaParado: string | undefined;

  if (safeSaldo > 0 && (ultimaSaida || primeiraEntrada)) {
    const ref = ultimaSaida || primeiraEntrada;
    const refParsed = typeof ref === 'string' ? Date.parse(ref.slice(0, 10)) : Date.UTC(ref!.getUTCFullYear(), ref!.getUTCMonth(), ref!.getUTCDate());
    if (today - refParsed >= 30 * DAY) {
      isStagnant = true;
      justificativaParado = 'Saldo positivo sem saídas há pelo menos 30 dias. Verifique a necessidade de novas compras.';
    }
  }

  let isExcess = false;
  let justificativaExcesso: string | undefined;

  if (diasRestantes !== null && diasRestantes > 90) {
    isExcess = true;
    justificativaExcesso = `Estoque para aproximadamente ${diasRestantes.toFixed(0)} dias no ritmo recente. Referência de acompanhamento: acima de 90 dias; considerar sazonalidade antes de decidir.`;
  }

  return {
    isStagnant,
    isExcess,
    justificativaParado,
    justificativaExcesso,
  };
}

/**
 * 6. Curva ABC e Capital Imobilizado
 */
export function calculateAbcCurve(produtos: AbcProductInput[]): AbcResult {
  if (!produtos || produtos.length === 0) {
    return { totalEstoqueFinanceiro: 0, produtos: [] };
  }

  const comValor = produtos.map((p) => {
    const precoValido = p.preco && p.preco > 0 ? p.preco : 0;
    const saldoValido = Math.max(0, p.saldo);
    const valorTotal = saldoValido * precoValido;
    return {
      ...p,
      valorTotal,
    };
  });

  comValor.sort((a, b) => b.valorTotal - a.valorTotal || a.id.localeCompare(b.id));

  const totalEstoqueFinanceiro = comValor.reduce((acc, p) => acc + p.valorTotal, 0);

  let acumulado = 0;
  const produtosOutput: AbcProductOutput[] = comValor.map((p) => {
    const percentual = totalEstoqueFinanceiro > 0 ? (p.valorTotal / totalEstoqueFinanceiro) * 100 : 0;
    const classe: 'A' | 'B' | 'C' =
      p.valorTotal <= 0
        ? 'C'
        : acumulado < 80
          ? 'A'
          : acumulado < 95
            ? 'B'
            : 'C';
    acumulado += percentual;

    return {
      ...p,
      percentual,
      percentualAcumulado: acumulado,
      classe,
    };
  });

  return {
    totalEstoqueFinanceiro,
    produtos: produtosOutput,
  };
}

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

