import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { GenealogyController } from './genealogy.controller';
import { GenealogyService } from './genealogy.service';
import { GraphRepository } from './graph.repository';
import { GraphSyncService } from './graph-sync.service';
import { MergeService } from './merge.service';
import { PermissionService } from './permission.service';

@Module({
  imports: [NotificationModule],
  controllers: [GenealogyController],
  providers: [GraphRepository, GenealogyService, PermissionService, MergeService, GraphSyncService],
  exports: [GraphSyncService, GraphRepository, MergeService, GenealogyService, PermissionService],
})
export class GenealogyModule {}
