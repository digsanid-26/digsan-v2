import { Module } from '@nestjs/common';
import { TreeController, PublicTreeController } from './tree.controller';
import { TreeService } from './tree.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [TreeController, PublicTreeController],
  providers: [TreeService],
  exports: [TreeService],
})
export class TreeModule {}
