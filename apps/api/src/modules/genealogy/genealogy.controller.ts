import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GenealogyService } from './genealogy.service';
import { GraphSyncService } from './graph-sync.service';
import { MergeService } from './merge.service';

class MergeDecisionDto {
  @IsBoolean()
  approve!: boolean;
}

const requireAdmin = (roles?: string[]) => {
  if (!roles?.some((r) => ['admin', 'super_admin'].includes(r))) throw new ForbiddenException('Akses ditolak');
};

@ApiTags('Genealogy Graph')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('genealogy')
export class GenealogyController {
  constructor(
    private readonly genealogy: GenealogyService,
    private readonly sync: GraphSyncService,
    private readonly merge: MergeService,
  ) {}

  @Get('merge-candidates')
  @ApiOperation({ summary: 'Likely duplicates the current user is asked to approve (as steward of either person)' })
  async mergeCandidates(@CurrentUser('id') userId: string) {
    return this.merge.listForUser(userId);
  }

  @Patch('merge-candidates/:id')
  @ApiOperation({ summary: 'Approve ("same person") or reject a merge; merges once every steward approved' })
  async decideMerge(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: MergeDecisionDto) {
    return this.merge.decide(userId, id, dto.approve);
  }

  @Post('admin/detect-duplicates')
  @ApiOperation({ summary: 'Run duplicate detection over the whole graph (admin)' })
  async detect(@CurrentUser('roles') roles?: string[]) {
    requireAdmin(roles);
    return this.merge.detect();
  }

  @Get('me/view')
  @ApiOperation({ summary: 'Family view around the current user from the canonical graph' })
  @ApiQuery({ name: 'up', required: false, type: Number })
  @ApiQuery({ name: 'down', required: false, type: Number })
  @ApiQuery({ name: 'mode', required: false, enum: ['nasab', 'hukum', 'sosial'] })
  async myView(
    @CurrentUser('id') userId: string,
    @Query('up') up?: string,
    @Query('down') down?: string,
    @Query('mode') mode?: string,
  ) {
    return this.genealogy.myView(userId, up ? Number(up) : 3, down ? Number(down) : 2, mode);
  }

  @Get('me/relation/:personId')
  @ApiOperation({ summary: 'How a person is related to the current user (kinship label)' })
  async relation(@CurrentUser('id') userId: string, @Param('personId') personId: string, @Query('mode') mode?: string) {
    return this.genealogy.relationToMe(userId, personId, mode);
  }

  @Get('admin/check')
  @ApiOperation({ summary: 'Graph invariant check (admin)' })
  async check(@CurrentUser('roles') roles?: string[]) {
    requireAdmin(roles);
    return this.genealogy.check();
  }

  @Post('admin/backfill')
  @ApiOperation({ summary: 'Project all legacy trees into the graph (admin). Dry-run unless ?apply=true' })
  @ApiQuery({ name: 'apply', required: false, type: Boolean })
  async backfill(@CurrentUser('roles') roles?: string[], @Query('apply') apply?: string) {
    requireAdmin(roles);
    return this.sync.backfill({ dryRun: apply !== 'true' });
  }
}
