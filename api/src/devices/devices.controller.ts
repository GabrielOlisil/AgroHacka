import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreatePairingDto, ConnectDeviceDto } from './dto/devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('pairing-token')
  @HttpCode(HttpStatus.CREATED)
  async createPairing(@Body() dto: CreatePairingDto) {
    return this.devicesService.createPairingToken(dto);
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@Body() dto: ConnectDeviceDto) {
    return this.devicesService.connectDevice(dto);
  }
}
