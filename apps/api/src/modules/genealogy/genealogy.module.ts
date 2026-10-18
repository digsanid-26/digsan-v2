import { Module } from '@nestjs/common';
import { GenealogyController } from './genealogy.controller';
import { GenealogyService } from './genealogy.service';
import { GraphRepository } from './graph.repository';
import { GraphSyncService } from './graph-sync.service';

@Module({
  controllers: [GenealogyController],
  providers: [GraphRepository, GraphSyncService, GenealogyService],
  exports: [GraphSyncService, GraphRepository],
})
export class GenealogyModule {}
