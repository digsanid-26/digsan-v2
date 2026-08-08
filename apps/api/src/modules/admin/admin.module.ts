import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EmailSettingsController } from './email-settings.controller';
import { EmailSettingsService } from './email-settings.service';
import { GamificationAdminController } from './gamification-admin.controller';
import { GamificationAdminService } from './gamification-admin.service';
import { AdvertisingAdminController } from './advertising-admin.controller';
import { AdvertisingAdminService } from './advertising-admin.service';
import { JobAdminController } from './job-admin.controller';
import { JobAdminService } from './job-admin.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AdminController, EmailSettingsController, GamificationAdminController, AdvertisingAdminController, JobAdminController],
  providers: [AdminService, EmailSettingsService, GamificationAdminService, AdvertisingAdminService, JobAdminService],
})
export class AdminModule {}
