import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { WhatsappService } from './whatsapp.service';
import { PushService } from './push.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, EmailService, WhatsappService, PushService],
  exports: [NotificationService, EmailService, WhatsappService, PushService],
})
export class NotificationModule {}
