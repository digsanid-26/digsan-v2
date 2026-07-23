import { Module } from '@nestjs/common';
import { AdvertisingController } from './advertising.controller';
import { AdvertisingAdminService } from '../admin/advertising-admin.service';

@Module({
  controllers: [AdvertisingController],
  providers: [AdvertisingAdminService],
  exports: [AdvertisingAdminService],
})
export class AdvertisingModule {}
