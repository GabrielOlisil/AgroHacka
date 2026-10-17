import {
  parseMovement,
  parseProduct,
  type Movement,
  type Product,
} from "./types";

export interface InventoryAlert {
  id: string;
  productId: string;
  tipo: "FALTA" | "VENCIMENTO" | "ANOMALIA" | "PARADO" | "EXCESSO";
  nivel: "URGENTE" | "ATENCAO" | "INFORMATIVO";
  titulo: string;
  justificativa: string;
}
export interface AnalyzedProduct extends Product {
  saldo: number;
  consumoMedioDiario: number;
  diasRestantes: number | null;
  valorEstoque: number;
  classeAbc: "A" | "B" | "C";
  percentualValor: number;
  consumoDiario: { dia: string; quantidade: number }[];
}
export interface InventoryAnalysis {
  products: AnalyzedProduct[];
  alerts: InventoryAlert[];
  totalValue: number;
  balancesByUnit: Record<string, number>;
}
const DAY = 86_400_000;

/** Janela de 30 dias de calendário UTC, incluindo dias sem retiradas desde a primeira amostra. */
export function analyzeInventory(
  products: Product[] | null | undefined,
  movements: Movement[] | null | undefined,
  now = new Date(),
): InventoryAnalysis {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Data de análise inválida.");
  const safeProducts = (products ?? []).map((p) => parseProduct(p));
  const safeMovements = (movements ?? []).map((m) => parseMovement(m));
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const alerts: InventoryAlert[] = [];
  const balancesByUnit: Record<string, number> = {};
  const result = safeProducts.map((p): AnalyzedProduct => {
    const history = safeMovements
      .filter(
        (m) =>
          m.productId === p.id &&
          m.farmId === p.farmId &&
          Date.parse(m.dataMovimento) <= now.getTime(),
      )
      .sort((a, b) => a.dataMovimento.localeCompare(b.dataMovimento));
    const saldo = history.reduce(
      (sum, m) => sum + (m.tipo === "ENTRADA" ? m.quantidade : -m.quantidade),
      0,
    );
    const out = history.filter(
      (m) =>
        m.tipo === "SAIDA" && Date.parse(m.dataMovimento) >= today - 29 * DAY,
    );
    const firstDay = out[0]
      ? Date.parse(out[0].dataMovimento.slice(0, 10))
      : today;
    const days = Math.max(1, Math.floor((today - firstDay) / DAY) + 1);
    const rate = out.reduce((sum, m) => sum + m.quantidade, 0) / days;
    const daysLeft = rate > 0 ? Math.max(0, saldo) / rate : null;
    const add = (
      tipo: InventoryAlert["tipo"],
      nivel: InventoryAlert["nivel"],
      justificativa: string,
    ) =>
      alerts.push({
        id: `${tipo}:${p.id}`,
        productId: p.id,
        tipo,
        nivel,
        titulo: `${p.nome} · ${tipo === "FALTA" ? "Reposição" : tipo === "VENCIMENTO" ? "Validade" : tipo === "ANOMALIA" ? "Consumo fora do padrão" : tipo === "PARADO" ? "Estoque parado" : "Excesso"}`,
        justificativa,
      });
    if (saldo <= p.estoqueMinimo)
      add(
        "FALTA",
        "URGENTE",
        `Saldo de ${saldo.toFixed(2)} ${p.unidadeMedida}, ${saldo <= 0 ? "zerado ou negativo" : "no mínimo ou abaixo do mínimo"} de ${p.estoqueMinimo} ${p.unidadeMedida}. ${rate === 0 ? "Sem histórico suficiente para estimar duração." : `Consumo médio de ${rate.toFixed(2)} ${p.unidadeMedida}/dia em ${days} dias; autonomia de ${daysLeft?.toFixed(1)} dias.`}`,
      );
    else if (daysLeft !== null && daysLeft <= 15)
      add(
        "FALTA",
        daysLeft <= 7 ? "URGENTE" : "ATENCAO",
        `Mantendo ${rate.toFixed(2)} ${p.unidadeMedida}/dia (últimos ${days} dias, incluindo dias sem saída), o saldo dura aproximadamente ${daysLeft.toFixed(1)} dias.`,
      );
    if (p.validade && saldo > 0) {
      const remaining = Math.round(
        (Date.parse(p.validade.slice(0, 10)) - today) / DAY,
      );
      const surplus = Math.max(0, saldo - Math.max(0, remaining) * rate);
      if (remaining < 0)
        add(
          "VENCIMENTO",
          "URGENTE",
          `Validade em ${p.validade.slice(0, 10)}: há ${Math.abs(remaining)} dias. Saldo de ${saldo.toFixed(2)} ${p.unidadeMedida}.`,
        );
      else if (remaining <= 30 && surplus > 0)
        add(
          "VENCIMENTO",
          remaining === 0 ? "URGENTE" : "ATENCAO",
          `Vence ${remaining === 0 ? "hoje" : `em ${remaining} dias`}; sobra estimada de ${surplus.toFixed(2)} ${p.unidadeMedida}, usando consumo médio de ${rate.toFixed(2)} ${p.unidadeMedida}/dia.${rate === 0 ? " Sem consumo recente, previsão de baixa confiança." : ""}`,
        );
    }
    if (out.length >= 4) {
      const previous = out.slice(0, -1);
      const mean =
        previous.reduce((sum, m) => sum + m.quantidade, 0) / previous.length;
      const last = out.at(-1)!;
      if (mean > 0 && last.quantidade >= mean * 3)
        add(
          "ANOMALIA",
          "ATENCAO",
          `Retirada de ${last.quantidade} ${p.unidadeMedida}: ${(last.quantidade / mean).toFixed(1)}x a média de ${mean.toFixed(2)} ${p.unidadeMedida} nas ${previous.length} retiradas anteriores. Critério: pelo menos 3x a média.`,
        );
    }
    const lastOut = history.filter((m) => m.tipo === "SAIDA").at(-1);
    const firstEntry = history.find((m) => m.tipo === "ENTRADA");
    if (
      saldo > 0 &&
      firstEntry &&
      today - Date.parse((lastOut ?? firstEntry).dataMovimento.slice(0, 10)) >=
        30 * DAY
    )
      add(
        "PARADO",
        "INFORMATIVO",
        "Saldo positivo sem saídas há pelo menos 30 dias. Verifique a necessidade de novas compras.",
      );
    if (daysLeft !== null && daysLeft > 90)
      add(
        "EXCESSO",
        "INFORMATIVO",
        `Estoque para aproximadamente ${daysLeft.toFixed(0)} dias no ritmo recente. Referência de acompanhamento: acima de 90 dias; considerar sazonalidade antes de decidir.`,
      );
    balancesByUnit[p.unidadeMedida] =
      (balancesByUnit[p.unidadeMedida] ?? 0) + saldo;
    const daily = new Map<string, number>();
    for (const m of out)
      daily.set(
        m.dataMovimento.slice(0, 10),
        (daily.get(m.dataMovimento.slice(0, 10)) ?? 0) + m.quantidade,
      );
    return {
      ...p,
      saldo,
      consumoMedioDiario: rate,
      diasRestantes: daysLeft,
      valorEstoque: Math.max(0, saldo) * (p.precoAquisicao ?? 0),
      classeAbc: "C",
      percentualValor: 0,
      consumoDiario: Array.from({ length: days }, (_, i) => {
        const dia = new Date(today - (days - 1 - i) * DAY)
          .toISOString()
          .slice(0, 10);
        return { dia, quantidade: daily.get(dia) ?? 0 };
      }),
    };
  });
  const totalValue = result.reduce((sum, p) => sum + p.valorEstoque, 0);
  let cumulative = 0;
  for (const p of [...result].sort(
    (a, b) => b.valorEstoque - a.valorEstoque || a.id.localeCompare(b.id),
  )) {
    p.percentualValor =
      totalValue > 0 ? (p.valorEstoque / totalValue) * 100 : 0;
    p.classeAbc =
      p.valorEstoque <= 0
        ? "C"
        : cumulative < 80
          ? "A"
          : cumulative < 95
            ? "B"
            : "C";
    cumulative += p.percentualValor;
  }
  const priority = { URGENTE: 0, ATENCAO: 1, INFORMATIVO: 2 };
  alerts.sort(
    (a, b) => priority[a.nivel] - priority[b.nivel] || a.id.localeCompare(b.id),
  );
  return { products: result, alerts, totalValue, balancesByUnit };
}
