import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendTestWhatsAppDto, DispatchAlertsDto } from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test-whatsapp')
  @HttpCode(HttpStatus.OK)
  async sendTest(@Body() dto: SendTestWhatsAppDto) {
    const mensagem = dto.mensagem || '🚜 Teste de Notificação WhatsApp AgroHack 2026/2 via Twilio';
    return this.notificationsService.sendWhatsAppMessage({
      paraTelefone: dto.paraTelefone,
      mensagem,
    });
  }

  @Post('dispatch-critical')
  @HttpCode(HttpStatus.OK)
  async dispatch(@Body() dto: DispatchAlertsDto) {
    return this.notificationsService.dispatchCriticalAlerts(dto.farmId);
  }
}
