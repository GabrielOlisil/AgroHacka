export class SyncMovementDto {
  id!: string;
  farmId!: string;
  productId!: string;
  tipo!: 'ENTRADA' | 'SAIDA';
  quantidade!: number;
  dataMovimento!: string;
  destino?: string;
  responsavel!: string;
  updatedAt?: string;
}

export class SyncPayloadDto {
  protocolVersion?: 2;
  farmId!: string;
  deviceId?: string;
  lastSyncTimestamp?: string;
  pendingMovements?: SyncMovementDto[];
}

export class SyncReceiptDto {
  id!: string;
  status!: 'ACCEPTED' | 'ID_PAYLOAD_CONFLICT' | 'VALIDATION_REJECTED';
  message?: string;
  movement?: SyncMovementDto;
}

export class SyncProductDto {
  id!: string;
  farmId!: string;
  nome!: string;
  categoria!: string;
  unidadeMedida!: string;
  estoqueMinimo!: number;
  precoAquisicao!: number | null;
  validade!: string | null;
  lote!: string | null;
  fornecedor!: string | null;
  /** false: desativado; some da lista, das retiradas e dos alertas. */
  ativo!: boolean;
  /** Preenchido quando o insumo foi excluído; o celular apaga a cópia local. */
  excluidoEm!: string | null;
  updatedAt!: string;
}

export class SyncDivergenceDto {
  productId!: string;
  saldo!: number;
  message!: string;
}

export class SyncResponseDto {
  protocolVersion!: 2;
  sucesso!: boolean;
  serverTimestamp!: string;
  syncedCount!: number;
  results!: SyncReceiptDto[];
  newMovements!: SyncMovementDto[];
  newProducts!: SyncProductDto[];
  divergences!: SyncDivergenceDto[];
}
