import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { GenealogyController } from './genealogy.controller';
import { GenealogyService } from './genealogy.service';
import { GraphRepository } from './graph.repository';
import { GraphSyncService } from './graph-sync.service';
import { MergeService } from './merge.service';

@Module({
  imports: [NotificationModule],
  controllers: [GenealogyController],
  providers: [GraphRepository, MergeService, GraphSyncService, GenealogyService],
  exports: [GraphSyncService, GraphRepository, MergeService],
})
export class GenealogyModule {}
