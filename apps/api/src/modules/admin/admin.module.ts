import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmailSettingsController } from './email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { GamificationAdminController } from './gamification-admin.controller';
import { GamificationAdminService } from './gamification-admin.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AdminController, EmailSettingsController, GamificationAdminController],
  providers: [AdminService, EmailSettingsService, GamificationAdminService],
})
export class AdminModule {}
