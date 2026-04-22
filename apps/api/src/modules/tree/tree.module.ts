import { Module } from '@nestjs/common';
import { TreeController, PublicTreeController } from './tree.controller';
import { TreeService } from './tree.service';

@Module({
  controllers: [TreeController, PublicTreeController],
  providers: [TreeService],
  exports: [TreeService],
})
export class TreeModule {}
