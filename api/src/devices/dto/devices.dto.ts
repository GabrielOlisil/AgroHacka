export class CreatePairingDto {
  farmId!: string;
  nomeOperador!: string;
}

export class ConnectDeviceDto {
  tokenOrCode!: string;
}

export class PairedOperatorDto {
  id!: string;
  farmId!: string;
  nomeOperador!: string;
  ativo!: boolean;
  pairingCode!: string | null;
  createdAt!: string;
}

export class OperatorsResponseDto {
  farmId!: string;
  operators!: PairedOperatorDto[];
}

export class UpdateOperatorDto {
  nomeOperador?: string;
  ativo?: boolean;
}

export class OperatorMutationResponseDto {
  farmId!: string;
  id!: string;
  sucesso!: boolean;
}
