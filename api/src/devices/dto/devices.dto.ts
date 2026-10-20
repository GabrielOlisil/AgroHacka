export class CreatePairingDto {
  farmId!: string;
  nomeOperador!: string;
}

export class ConnectDeviceDto {
  tokenOrCode!: string;
}
