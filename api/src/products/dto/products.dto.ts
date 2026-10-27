export class CreateProductDto {
  /** UUID criado pelo cliente uma única vez e preservado nos retries. */
  id!: string;
  nome!: string;
  /** Categoria livre, incluindo Unicode. */
  categoria!: string;
  /** Texto livre; aliases conhecidos são normalizados sem conversão de quantidade. */
  unidadeMedida!: string;
  /** Número finito maior ou igual a zero; não representa saldo inicial. */
  estoqueMinimo!: number;
  /** Ausente/null significa preço desconhecido; zero informado é válido. */
  precoAquisicao?: number | null;
  /** Data de calendário válida em YYYY-MM-DD; ausente/null significa desconhecida. */
  validade?: string | null;
  lote?: string | null;
  fornecedor?: string | null;
}

export class ProductResponseDto {
  id!: string;
  farmId!: string;
  nome!: string;
  categoria!: string;
  unidadeMedida!: string;
  estoqueMinimo!: number;
  precoAquisicao!: number | null;
  /** ISO 8601 à meia-noite UTC, compatível com newProducts no download de sync. */
  validade!: string | null;
  lote!: string | null;
  fornecedor!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
