import {
  Controller,
  Post,
  Body,
  Headers,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { DevicesService } from './devices.service';
import {
  CreatePairingDto,
  ConnectDeviceDto,
  UpdateLocalIpDto,
} from './dto/devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly auth: AuthService,
  ) {}

  @Post('pairing-token')
  @HttpCode(HttpStatus.CREATED)
  async createPairing(
    @Body() dto: CreatePairingDto,
    @Headers('authorization') authorization?: string,
  ) {
    const identity = await this.auth.authenticateSync(authorization);
    if (identity.role !== 'GESTOR' || dto.farmId !== identity.farmId)
      throw new ForbiddenException();
    return this.devicesService.createPairingToken(dto);
  }

  @Post('local-ip')
  @HttpCode(HttpStatus.OK)
  async updateLocalIp(
    @Body() dto: UpdateLocalIpDto,
    @Headers('authorization') authorization?: string,
  ) {
    const identity = await this.auth.authenticateSync(authorization);
    if (identity.role !== 'GESTOR' || dto.farmId !== identity.farmId)
      throw new ForbiddenException();
    return this.devicesService.updateLocalIp(dto);
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@Body() dto: ConnectDeviceDto) {
    return this.devicesService.connectDevice(dto);
  }
}
