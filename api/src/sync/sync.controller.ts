import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ApiHeader } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncPayloadDto, SyncResponseDto } from './dto/sync.dto';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @ApiHeader({
    name: 'authorization',
    required: false,
    description: 'JWT do gestor; alternativamente envie x-device-token.',
  })
  @ApiHeader({
    name: 'x-device-token',
    required: false,
    description: 'Credencial de operador ativo; não combine com Authorization.',
  })
  @HttpCode(HttpStatus.OK)
  async sync(
    @Body() dto: SyncPayloadDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-device-token') deviceToken?: string,
  ): Promise<SyncResponseDto> {
    return this.syncService.syncData(
      dto,
      await this.auth.authenticateSync(authorization, deviceToken),
    );
  }
}
