export class SyncMovementDto {
  id!: string;
  farmId!: string;
  productId!: string;
  tipo!: 'ENTRADA' | 'SAIDA';
  quantidade!: number;
  dataMovimento!: Date | string;
  destino?: string;
  responsavel!: string;
  updatedAt?: Date | string;
}

export class SyncPayloadDto {
  farmId!: string;
  deviceId?: string;
  lastSyncTimestamp?: string;
  pendingMovements?: SyncMovementDto[];
}

export class HeartbeatDto {
  farmId!: string;
  localIp!: string;
  localPort?: number;
}
