import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from './notifications.service';
import { SendTestWhatsAppDto, DispatchAlertsDto } from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auth: AuthService,
  ) {}

  private async requireManager(authorization?: string) {
    const identity = await this.auth.authenticateSync(authorization);
    if (identity.role !== 'GESTOR') throw new ForbiddenException();
    return identity;
  }

  @Post('test-whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'JWT do gestor da fazenda.',
  })
  async sendTest(
    @Body() dto: SendTestWhatsAppDto,
    @Headers('authorization') authorization?: string,
  ) {
    const identity = await this.requireManager(authorization);
    const mensagem = dto.mensagem || '🚜 Teste de Notificação WhatsApp AgroHack 2026/2 via Twilio';
    return this.notificationsService.sendTestMessage({
      farmId: identity.farmId,
      paraTelefone: dto.paraTelefone,
      mensagem,
    });
  }

  @Post('dispatch-critical')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'authorization',
    required: true,
    description: 'JWT do gestor da fazenda.',
  })
  async dispatch(
    @Body() dto: DispatchAlertsDto,
    @Headers('authorization') authorization?: string,
  ) {
    const identity = await this.requireManager(authorization);
    if (dto.farmId !== identity.farmId) throw new ForbiddenException();
    return this.notificationsService.dispatchCriticalAlerts(identity.farmId);
  }
}
