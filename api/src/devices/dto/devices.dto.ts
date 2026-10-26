export class CreatePairingDto {
  farmId!: string;
  nomeOperador!: string;
}

export class ConnectDeviceDto {
  tokenOrCode!: string;
}

export class UpdateLocalIpDto {
  farmId!: string;
  localIp!: string;
  localPort?: number;
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
