import type { components } from "../types/contract";

export type LoginInput = components["schemas"]["LoginDto"];
export type RegisterInput = components["schemas"]["RegisterDto"];
export type PairingInput = components["schemas"]["CreatePairingDto"];
export type ConnectInput = components["schemas"]["ConnectDeviceDto"];
export type Movement = components["schemas"]["SyncMovementDto"];
export type SyncPayload = components["schemas"]["SyncPayloadDto"];
export type PairedOperator = components["schemas"]["PairedOperatorDto"];
export type UpdateOperatorInput = components["schemas"]["UpdateOperatorDto"];

export function parseOperatorUpdate(value: unknown): UpdateOperatorInput {
  const patch = object(value);
  if (
    !Object.keys(patch).length ||
    Object.keys(patch).some((key) => key !== "nomeOperador" && key !== "ativo")
  )
    throw new Error("Campos de operador inválidos.");
  const result: UpdateOperatorInput = {};
  if ("nomeOperador" in patch) {
    const name = text(patch.nomeOperador, "nome do operador").normalize("NFC");
    if (name.length > 100) throw new Error("Nome do operador inválido.");
    result.nomeOperador = name;
  }
  if ("ativo" in patch) {
    if (typeof patch.ativo !== "boolean")
      throw new Error("Situação do operador inválida.");
    result.ativo = patch.ativo;
  }
  return result;
}

export function parsePairedOperators(
  value: unknown,
  farmId: string,
): PairedOperator[] {
  const response = object(value);
  if (response.farmId !== farmId || !Array.isArray(response.operators))
    throw new Error("Listagem de operadores inválida ou de outra fazenda.");
  const ids = new Set<string>();
  return response.operators.map((value) => {
    const operator = object(value);
    const id = text(operator.id, "dispositivo");
    if (
      ids.has(id) ||
      operator.farmId !== farmId ||
      typeof operator.ativo !== "boolean"
    )
      throw new Error("Operadores repetidos, inválidos ou de outra fazenda.");
    ids.add(id);
    const pairingCode = operator.ativo
      ? text(operator.pairingCode, "código de pareamento")
      : null;
    if (!operator.ativo && operator.pairingCode !== null)
      throw new Error("Código de dispositivo inativo não deve ser exposto.");
    return {
      id,
      farmId,
      nomeOperador: text(operator.nomeOperador, "nome do operador"),
      ativo: operator.ativo,
      pairingCode,
      createdAt: date(operator.createdAt),
    };
  });
}

export interface Product {
  id: string;
  farmId: string;
  nome: string;
  categoria: string;
  unidadeMedida: string;
  estoqueMinimo: number;
  precoAquisicao: number | null;
  validade: string | null;
  lote?: string | null;
  fornecedor?: string | null;
  /** false: desativado; fica fora da lista, das retiradas e dos alertas. */
  ativo?: boolean;
  /** Excluído pelo gestor; a cópia local é apagada quando possível. */
  excluidoEm?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
export type UpdateProductInput = components["schemas"]["UpdateProductDto"];
/** UUID pertence ao modal e permanece estável em todas as tentativas. */
type CreateProductDto = components["schemas"]["CreateProductDto"];
export type ProductInput = Omit<
  CreateProductDto,
  "precoAquisicao" | "validade"
> &
  Required<Pick<CreateProductDto, "precoAquisicao" | "validade">>;

export function parseProductInput(value: unknown): ProductInput {
  const p = object(value);
  const fields = [
    "id",
    "nome",
    "categoria",
    "unidadeMedida",
    "estoqueMinimo",
    "precoAquisicao",
    "validade",
    "lote",
    "fornecedor",
  ];
  if (Object.keys(p).some((key) => !fields.includes(key)))
    throw new Error("Campo desconhecido no cadastro de produto.");
  if (
    typeof p.id !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      p.id,
    )
  )
    throw new Error("Identificador do produto deve ser UUID.");
  const id = p.id.toLowerCase();
  const normalizedText = (value: unknown, field: string) =>
    text(value, field).normalize("NFC");
  const unit = normalizedText(p.unidadeMedida, "unidade");
  const units: Record<string, string> = {
    l: "L",
    lt: "L",
    litro: "L",
    litros: "L",
    kg: "kg",
    quilo: "kg",
    quilos: "kg",
    quilograma: "kg",
    quilogramas: "kg",
    t: "t",
    ton: "t",
    tonelada: "t",
    toneladas: "t",
    un: "un",
    und: "un",
    unidade: "un",
    unidades: "un",
    sc: "sc",
    saco: "sc",
    sacos: "sc",
    saca: "sc",
    sacas: "sc",
    m: "m",
    metro: "m",
    metros: "m",
  };
  let validade: string | null = null;
  if (p.validade != null) {
    if (
      typeof p.validade !== "string" ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(p.validade)
    )
      throw new Error("Validade deve ser uma data YYYY-MM-DD.");
    const calendarDate = new Date(`${p.validade}T00:00:00.000Z`);
    if (
      !Number.isFinite(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== p.validade
    )
      throw new Error("Data de calendário inválida.");
    validade = p.validade;
  }
  const result: ProductInput = {
    id,
    nome: normalizedText(p.nome, "nome"),
    categoria: normalizedText(p.categoria, "categoria"),
    unidadeMedida: Object.hasOwn(units, unit.toLowerCase())
      ? units[unit.toLowerCase()]!
      : unit,
    estoqueMinimo: number(p.estoqueMinimo, "estoque mínimo"),
    precoAquisicao:
      p.precoAquisicao == null ? null : number(p.precoAquisicao, "preço"),
    validade,
  };
  for (const key of ["lote", "fornecedor"] as const)
    if (p[key] !== undefined)
      result[key] = p[key] === null ? null : normalizedText(p[key], key);
  return result;
}
export interface Session {
  role: "GESTOR" | "OPERADOR";
  farmId: string;
  farmNome: string;
  nome: string;
  userId?: string;
  deviceId?: string;
  accessToken?: string;
  deviceToken?: string;
  telefone?: string;
}
export interface SyncResponse {
  protocolVersion: 2;
  results: SyncReceipt[];
  divergences: SyncDivergence[];
  sucesso: true;
  serverTimestamp: string;
  syncedCount: number;
  newMovements: Movement[];
  newProducts: Product[];
}

export type SyncReceipt = Omit<
  components["schemas"]["SyncReceiptDto"],
  "movement"
> & { movement?: Movement };
export type SyncDivergence = components["schemas"]["SyncDivergenceDto"];
export interface SyncReview {
  id: string;
  status: "ID_PAYLOAD_CONFLICT" | "VALIDATION_REJECTED";
  message: string;
  movement: Movement;
}
export interface PairingResponse {
  deviceToken: string;
  pairingCode: string;
  qrPayload: {
    farmId: string;
    farmNome: string;
    nomeOperador: string;
    deviceToken: string;
  };
}
export interface MovementInput {
  id?: string;
  productId: string;
  tipo: "ENTRADA" | "SAIDA";
  quantidade: number;
  dataMovimento: string;
  destino?: string;
}

export function sameMovement(a: Movement, b: Movement): boolean {
  return (
    a.id === b.id &&
    a.farmId === b.farmId &&
    a.productId === b.productId &&
    a.tipo === b.tipo &&
    a.quantidade === b.quantidade &&
    date(a.dataMovimento) === date(b.dataMovimento) &&
    (a.destino ?? "") === (b.destino ?? "")
  );
}

export function parseSyncResponse(
  value: unknown,
  farmId: string,
  pending?: Movement[],
): SyncResponse {
  const response = object(value);
  if (response.protocolVersion !== 2 || !Array.isArray(response.results))
    throw new Error(
      "Versão de sync sem confirmações individuais. Atualize a API antes de sincronizar.",
    );
  if (
    response.sucesso !== true ||
    !Array.isArray(response.newProducts) ||
    !Array.isArray(response.newMovements) ||
    !Array.isArray(response.divergences)
  )
    throw new Error("Resposta de sincronização inválida.");
  const newProducts = response.newProducts.map((p) => parseProduct(p, farmId));
  const newMovements = response.newMovements.map((m) =>
    parseMovement(m, farmId),
  );
  const results: SyncReceipt[] = response.results.map((value) => {
    const r = object(value);
    const id = text(r.id, "confirmação");
    if (r.status === "ACCEPTED") {
      const movement = parseMovement(r.movement, farmId);
      if (movement.id !== id)
        throw new Error("Confirmação de outro identificador.");
      return { id, status: r.status, movement };
    }
    if (
      r.status !== "ID_PAYLOAD_CONFLICT" &&
      r.status !== "VALIDATION_REJECTED"
    )
      throw new Error("Confirmação desconhecida.");
    return {
      id,
      status: r.status,
      message: text(r.message, "motivo da revisão"),
    };
  });
  const resultIds = new Set(results.map((r) => r.id));
  const syncedCount = number(response.syncedCount, "confirmações");
  if (
    !Number.isInteger(syncedCount) ||
    syncedCount !== results.filter((r) => r.status === "ACCEPTED").length ||
    resultIds.size !== results.length
  )
    throw new Error("Confirmações incompletas ou repetidas.");
  if (
    new Set(newProducts.map((p) => p.id)).size !== newProducts.length ||
    new Set(newMovements.map((m) => m.id)).size !== newMovements.length
  )
    throw new Error("Snapshot com registros repetidos.");
  if (pending) {
    if (
      results.length !== pending.length ||
      pending.some((m) => !resultIds.has(m.id))
    )
      throw new Error("Confirmações incompletas do lote.");
    const submitted = new Map(pending.map((m) => [m.id, m]));
    for (const r of results)
      if (
        r.status === "ACCEPTED" &&
        (!r.movement || !sameMovement(submitted.get(r.id)!, r.movement))
      )
        throw new Error("Confirmação incompatível com a movimentação enviada.");
  }
  const divergences = response.divergences.map((value) => {
    const d = object(value);
    return {
      productId: text(d.productId, "produto divergente"),
      saldo: number(d.saldo, "saldo", -Infinity),
      message: text(d.message, "divergência"),
    };
  });
  return {
    protocolVersion: 2,
    sucesso: true,
    syncedCount,
    results,
    divergences,
    newProducts,
    newMovements,
    serverTimestamp: date(response.serverTimestamp),
  };
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Dados ausentes ou inválidos.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Campo inválido: ${field}.`);
  return value.trim();
}
export function number(value: unknown, field: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    throw new Error(`Valor inválido: ${field}.`);
  return value;
}
export function date(value: unknown): string {
  const result = text(value, "data");
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(result);
  if (!match || !Number.isFinite(Date.parse(result)))
    throw new Error("Data inválida.");
  const calendarDate = new Date(`${result.slice(0, 10)}T00:00:00.000Z`);
  if (calendarDate.toISOString().slice(0, 10) !== result.slice(0, 10))
    throw new Error("Data de calendário inválida.");
  return new Date(result).toISOString();
}
export function parseSession(value: unknown): Session {
  const s = object(value);
  if (s.role !== "GESTOR" && s.role !== "OPERADOR")
    throw new Error("Perfil inválido.");
  const result: Session = {
    role: s.role,
    farmId: text(s.farmId, "fazenda"),
    farmNome: text(s.farmNome, "nome da fazenda"),
    nome: text(s.nome, "nome"),
  };
  for (const key of [
    "userId",
    "deviceId",
    "accessToken",
    "deviceToken",
  ] as const)
    if (s[key] !== undefined) result[key] = text(s[key], key);
  if (typeof s.telefone === "string" && s.telefone.trim())
    result.telefone = s.telefone.trim();
  return result;
}
export function parseProduct(value: unknown, farmId?: string): Product {
  const p = object(value);
  const result: Product = {
    id: text(p.id, "produto"),
    farmId: text(p.farmId, "fazenda"),
    nome: text(p.nome, "nome"),
    categoria: text(p.categoria, "categoria"),
    unidadeMedida: text(p.unidadeMedida, "unidade"),
    estoqueMinimo: number(p.estoqueMinimo, "estoque mínimo"),
    precoAquisicao:
      p.precoAquisicao == null ? null : number(p.precoAquisicao, "preço"),
    validade: p.validade == null ? null : date(p.validade),
  };
  if (farmId && result.farmId !== farmId)
    throw new Error("Produto de outra fazenda.");
  for (const key of ["lote", "fornecedor"] as const)
    if (p[key] !== undefined)
      result[key] = p[key] === null ? null : String(p[key]);
  if (p.ativo !== undefined) {
    if (typeof p.ativo !== "boolean") throw new Error("Situação inválida.");
    result.ativo = p.ativo;
  }
  if (p.excluidoEm !== undefined)
    result.excluidoEm = p.excluidoEm === null ? null : date(p.excluidoEm);
  if (p.updatedAt !== undefined) result.updatedAt = date(p.updatedAt);
  if (p.createdAt !== undefined) result.createdAt = date(p.createdAt);
  return result;
}
export function parseMovement(value: unknown, farmId?: string): Movement {
  const m = object(value);
  if (m.tipo !== "ENTRADA" && m.tipo !== "SAIDA")
    throw new Error("Tipo de movimentação inválido.");
  const quantity = number(m.quantidade, "quantidade");
  if (quantity === 0) throw new Error("Quantidade deve ser maior que zero.");
  const result: Movement = {
    id: text(m.id, "identificador"),
    farmId: text(m.farmId, "fazenda"),
    productId: text(m.productId, "produto"),
    tipo: m.tipo,
    quantidade: quantity,
    dataMovimento: date(m.dataMovimento),
    responsavel: text(m.responsavel, "responsável"),
  };
  if (farmId && result.farmId !== farmId)
    throw new Error("Movimentação de outra fazenda.");
  if (m.destino !== undefined && m.destino !== null)
    result.destino = String(m.destino);
  if (m.updatedAt !== undefined && m.updatedAt !== null)
    result.updatedAt = date(m.updatedAt);
  return result;
}
