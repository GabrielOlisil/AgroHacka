import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import twilio from 'twilio';

export interface SendWhatsAppDto {
  paraTelefone: string;
  mensagem: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private twilioClient: any = null;
  private readonly twilioPhone: string;

  constructor(private readonly prisma: PrismaService) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhone = process.env.TWILIO_PHONE || '+14155238886'; // Sandbox oficial da Twilio

    if (accountSid && authToken && !accountSid.startsWith('mock')) {
      try {
        this.twilioClient = twilio(accountSid, authToken);
        this.logger.log('Twilio WhatsApp Client inicializado com sucesso.');
      } catch (err) {
        this.logger.warn('Falha ao inicializar Twilio client, operando em modo simulação.');
      }
    } else {
      this.logger.log('Twilio não configurado. Notificações WhatsApp rodando em modo simulação.');
    }
  }

  async sendWhatsAppMessage(dto: SendWhatsAppDto) {
    let cleanPhone = dto.paraTelefone.trim().replace(/\s+/g, '');
    if (!cleanPhone.startsWith('whatsapp:')) {
      cleanPhone = `whatsapp:${cleanPhone}`;
    }

    let fromPhone = this.twilioPhone;
    if (!fromPhone.startsWith('whatsapp:')) {
      fromPhone = `whatsapp:${fromPhone}`;
    }

    if (!this.twilioClient) {
      this.logger.log(`[SIMULAÇÃO WHATSAPP] Para: ${cleanPhone} | Mensagem: ${dto.mensagem}`);
      return {
        sucesso: true,
        modo: 'SIMULADO',
        paraTelefone: cleanPhone,
        mensagem: dto.mensagem,
      };
    }

    try {
      const message = await this.twilioClient.messages.create({
        from: fromPhone,
        to: cleanPhone,
        body: dto.mensagem,
      });

      return {
        sucesso: true,
        messageSid: message.sid,
        status: message.status,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao disparar mensagem WhatsApp: ${error.message}`);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  async dispatchCriticalAlerts(farmId: string) {
    const gestor = await this.prisma.user.findFirst({
      where: { farmId, role: 'GESTOR' },
    });

    if (!gestor || !gestor.telefone) {
      return {
        totalEnviados: 0,
        motivo: 'Gestor sem telefone cadastrado para notificações WhatsApp.',
      };
    }

    const criticalAlerts = await this.prisma.alert.findMany({
      where: {
        farmId,
        nivelUrgencia: 'ALTA',
        notificadoWhatsapp: false,
      },
      include: {
        product: true,
      },
    });

    if (criticalAlerts.length === 0) {
      return {
        totalEnviados: 0,
        motivo: 'Nenhum alerta crítico pendente de notificação.',
      };
    }

    let enviados = 0;

    for (const alert of criticalAlerts) {
      const produtoNome = alert.product?.nome || 'Insumo não identificado';
      const texto = `⚠️ *ALERTA AGROHACK — GESTÃO DE ESTOQUE*\n\n` +
        `*Insumo:* ${produtoNome}\n` +
        `*Nível:* CRÍTICO 🚨\n` +
        `*Diagnóstico:* ${alert.justificativa}\n\n` +
        `_Ação recomendada: Avalie nova aquisição ou redistribuição no campo._`;

      const sendResult = await this.sendWhatsAppMessage({
        paraTelefone: gestor.telefone,
        mensagem: texto,
      });

      if (sendResult.sucesso) {
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { notificadoWhatsapp: true },
        });
        enviados++;
      }
    }

    return {
      totalEnviados: enviados,
      gestorNotificado: gestor.nome,
      telefone: gestor.telefone,
    };
  }
}
