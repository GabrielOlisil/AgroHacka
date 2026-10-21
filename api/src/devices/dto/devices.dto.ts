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
