import { Module } from '@nestjs/common';
import { TreeController, PublicTreeController, PublicFamilyController } from './tree.controller';
import { TreeService } from './tree.service';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { GenealogyModule } from '../genealogy/genealogy.module';

@Module({
  imports: [NotificationModule, AuthModule, GamificationModule, GenealogyModule],
  controllers: [TreeController, PublicTreeController, PublicFamilyController],
  providers: [TreeService],
  exports: [TreeService],
})
export class TreeModule {}
