export interface NormalizedProduct {
  nome: string;
  unidadeMedida: string;
}

export interface RunoutResult {
  diasRestantes: number | null;
  consumoMedioDiario: number;
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
 * 2. Cálculo de Runout Time (Autonomia e Risco de Falta)
 */
export function calculateRunoutTime(
  saldoAtual: number,
  estoqueMinimo: number,
  saidas: { quantidade: number; data: Date }[],
): RunoutResult {
  const safeSaldo = Math.max(0, saldoAtual);

  if (safeSaldo === 0) {
    return {
      diasRestantes: 0,
      consumoMedioDiario: 0,
      status: 'CRITICO',
      justificativa: 'Estoque zerado! Ação imediata de compra recomendada.',
      confiabilidade: 'ALTA',
    };
  }

  if (!saidas || saidas.length === 0) {
    return {
      diasRestantes: null,
      consumoMedioDiario: 0,
      status: safeSaldo < estoqueMinimo ? 'CRITICO' : 'NORMAL',
      justificativa: 'Sem histórico de consumo recente para projetar autonomia.',
      confiabilidade: 'BAIXA',
    };
  }

  const totalConsumido = saidas.reduce((acc, s) => acc + s.quantidade, 0);
  const consumoMedioDiario = totalConsumido / saidas.length;

  if (consumoMedioDiario <= 0) {
    return {
      diasRestantes: null,
      consumoMedioDiario: 0,
      status: safeSaldo < estoqueMinimo ? 'CRITICO' : 'NORMAL',
      justificativa: 'Consumo recente nulo ou não registrado.',
      confiabilidade: 'BAIXA',
    };
  }

  const diasRestantes = Math.round(safeSaldo / consumoMedioDiario);
  const confiabilidade = saidas.length >= 5 ? 'ALTA' : saidas.length >= 3 ? 'MEDIA' : 'BAIXA';
  const status = diasRestantes <= 7 || safeSaldo <= estoqueMinimo ? 'CRITICO' : diasRestantes <= 15 ? 'ATENCAO' : 'NORMAL';

  return {
    diasRestantes,
    consumoMedioDiario,
    status,
    justificativa: `Mantendo o consumo médio recente de ${consumoMedioDiario.toFixed(1)}/dia, o saldo atual será suficiente por aproximadamente ${diasRestantes} dias.`,
    confiabilidade,
  };
}

/**
 * 3. Risco de Vencimento vs. Ritmo de Uso
 */
export function checkExpiryRisk(
  saldoAtual: number,
  consumoMedioDiario: number,
  dataValidade: Date | null,
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

  const now = new Date();
  const diffTime = dataValidade.getTime() - now.getTime();
  const diasAteVencimento = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diasAteVencimento <= 0) {
    return {
      temRisco: true,
      diasAteVencimento,
      sobraEstimada: saldoAtual,
      jaVenceu: true,
      justificativa: `Produto já se encontra vencido há ${Math.abs(diasAteVencimento)} dias! Não aplicar no campo sem laudo técnico.`,
    };
  }

  const consumoAteVencimento = diasAteVencimento * Math.max(0, consumoMedioDiario);
  const sobraEstimada = Math.max(0, saldoAtual - consumoAteVencimento);

  if (sobraEstimada > 0) {
    return {
      temRisco: true,
      diasAteVencimento,
      sobraEstimada,
      jaVenceu: false,
      justificativa: `Atenção: no ritmo atual de consumo, cerca de ${sobraEstimada.toFixed(0)} unidades irão vencer antes de serem utilizadas (vencimento em ${diasAteVencimento} dias).`,
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
 * 5. Curva ABC e Capital Imobilizado
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

  comValor.sort((a, b) => b.valorTotal - a.valorTotal);

  const totalEstoqueFinanceiro = comValor.reduce((acc, p) => acc + p.valorTotal, 0);

  let acumulado = 0;
  const produtosOutput: AbcProductOutput[] = comValor.map((p, index) => {
    const percentual = totalEstoqueFinanceiro > 0 ? (p.valorTotal / totalEstoqueFinanceiro) * 100 : 0;
    acumulado += percentual;

    let classe: 'A' | 'B' | 'C' = 'C';
    // O primeiro item é sempre A se tiver valor
    if (index === 0 && p.valorTotal > 0) {
      classe = 'A';
    } else if (acumulado - percentual < 80) {
      classe = 'A';
    } else if (acumulado - percentual < 95 || (index === 1 && comValor.length > 2)) {
      classe = 'B';
    } else {
      classe = 'C';
    }

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
 * 6. Priorização de Alertas
 */
export function prioritizeAlerts(alertas: AlertInput[]): AlertInput[] {
  if (!alertas || alertas.length === 0) return [];

  const pesos = {
    URGENTE: 3,
    ATENCAO: 2,
    INFORMATIVO: 1,
  };

  return [...alertas].sort((a, b) => (pesos[b.nivel] || 0) - (pesos[a.nivel] || 0));
}
