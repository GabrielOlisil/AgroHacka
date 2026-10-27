import {
  Controller,
  Post,
  Get,
  Header,
  Body,
  Headers,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Patch,
  Delete,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import {
  CreatePairingDto,
  ConnectDeviceDto,
  OperatorsResponseDto,
  UpdateOperatorDto,
  OperatorMutationResponseDto,
} from './dto/devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly auth: AuthService,
  ) {}

  private async manager(request: Request) {
    const identity = await this.auth.authenticateSync(
      request.get('authorization'),
      request.get('x-device-token'),
    );
    if (identity.role !== 'GESTOR') throw new ForbiddenException();
    return identity;
  }

  @Patch(':id')
  @ApiBearerAuth()
  async updateOperator(
    @Param('id') id: string,
    @Body() dto: UpdateOperatorDto,
    @Req() request: Request,
  ): Promise<OperatorMutationResponseDto> {
    const identity = await this.manager(request);
    return this.devicesService.updateOperator(identity.farmId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  async deleteOperator(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<OperatorMutationResponseDto> {
    const identity = await this.manager(request);
    return this.devicesService.deleteOperator(identity.farmId, id);
  }

  @Get()
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'JWT do gestor da fazenda.',
  })
  @Header('Cache-Control', 'no-store')
  async listOperators(
    @Headers('authorization') authorization?: string,
  ): Promise<OperatorsResponseDto> {
    const identity = await this.auth.authenticateSync(authorization);
    if (identity.role !== 'GESTOR') throw new ForbiddenException();
    return this.devicesService.listOperators(identity.farmId);
  }

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

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@Body() dto: ConnectDeviceDto) {
    return this.devicesService.connectDevice(dto);
  }
}
