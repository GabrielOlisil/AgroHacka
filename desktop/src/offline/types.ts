import type { components } from "../types/contract";

export type LoginInput = components["schemas"]["LoginDto"];
export type RegisterInput = components["schemas"]["RegisterDto"];
export type PairingInput = components["schemas"]["CreatePairingDto"];
export type ConnectInput = components["schemas"]["ConnectDeviceDto"];
// O gerador descreve Date | string como objeto. A API efetivamente recebe ISO.
export type Movement = Omit<
  components["schemas"]["SyncMovementDto"],
  "dataMovimento" | "updatedAt"
> & { dataMovimento: string; updatedAt?: string };
export type SyncPayload = Omit<
  components["schemas"]["SyncPayloadDto"],
  "pendingMovements"
> & { pendingMovements?: Movement[] };

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
  updatedAt?: string;
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
  localIp?: string | null;
  localPort?: number;
}
export interface SyncResponse {
  sucesso: true;
  serverTimestamp: string;
  syncedCount: number;
  newMovements: Movement[];
  newProducts: Product[];
}
export interface PairingResponse {
  deviceToken: string;
  pairingCode: string;
  qrPayload: {
    farmId: string;
    farmNome: string;
    nomeOperador: string;
    deviceToken: string;
    localIp?: string | null;
    localPort?: number;
  };
}
export interface MovementInput {
  productId: string;
  tipo: "ENTRADA" | "SAIDA";
  quantidade: number;
  dataMovimento: string;
  destino?: string;
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
  const calendarDate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
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
  if (s.localIp !== undefined)
    result.localIp = s.localIp === null ? null : text(s.localIp, "IP");
  if (s.localPort !== undefined) {
    const port = number(s.localPort, "porta", 1);
    if (!Number.isInteger(port) || port > 65535)
      throw new Error("Porta inválida.");
    result.localPort = port;
  }
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
  if (p.updatedAt !== undefined) result.updatedAt = date(p.updatedAt);
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
