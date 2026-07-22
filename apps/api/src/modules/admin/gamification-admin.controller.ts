import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { GamificationAdminService } from './gamification-admin.service';
import {
  CreatePointTypeDto,
  UpdatePointTypeDto,
  PointLogQueryDto,
  CreateRewardDto,
  UpdateRewardDto,
  RedeemStatusDto,
  RedeemQueryDto,
} from './dto/gamification-admin.dto';

@ApiTags('Admin / Gamification')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'super_admin')
@Controller('admin/gamification')
export class GamificationAdminController {
  constructor(private readonly gamiAdminService: GamificationAdminService) {}

  // ─── POINT TYPES (Gami Konfigurasi) ──────────────────────────

  @Get('point-types')
  @ApiOperation({ summary: 'List all point types' })
  async getPointTypes() {
    return this.gamiAdminService.getPointTypes();
  }

  @Post('point-types')
  @ApiOperation({ summary: 'Create a new point type' })
  async createPointType(@Body() dto: CreatePointTypeDto) {
    return this.gamiAdminService.createPointType(dto);
  }

  @Put('point-types/:id')
  @ApiOperation({ summary: 'Update a point type' })
  async updatePointType(@Param('id') id: string, @Body() dto: UpdatePointTypeDto) {
    return this.gamiAdminService.updatePointType(id, dto);
  }

  @Delete('point-types/:id')
  @ApiOperation({ summary: 'Delete a point type' })
  async deletePointType(@Param('id') id: string) {
    return this.gamiAdminService.deletePointType(id);
  }

  // ─── STATS & LOGS ────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get gamification statistics overview' })
  async getStats() {
    return this.gamiAdminService.getStats();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get point transaction logs (paginated, filterable)' })
  async getPointLogs(@Query() query: PointLogQueryDto) {
    return this.gamiAdminService.getPointLogs(query);
  }

  @Get('top-users')
  @ApiOperation({ summary: 'Get top 10 users by points' })
  async getTopUsers(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamiAdminService.getTopUsers(type, limit ? parseInt(limit) : 10);
  }

  // ─── REWARDS ─────────────────────────────────────────────────

  @Get('rewards')
  @ApiOperation({ summary: 'List all rewards' })
  async getRewards() {
    return this.gamiAdminService.getRewards();
  }

  @Post('rewards')
  @ApiOperation({ summary: 'Create a new reward' })
  async createReward(@Body() dto: CreateRewardDto) {
    return this.gamiAdminService.createReward(dto);
  }

  @Put('rewards/:id')
  @ApiOperation({ summary: 'Update a reward' })
  async updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.gamiAdminService.updateReward(id, dto);
  }

  @Delete('rewards/:id')
  @ApiOperation({ summary: 'Delete a reward' })
  async deleteReward(@Param('id') id: string) {
    return this.gamiAdminService.deleteReward(id);
  }

  // ─── REDEEM REQUESTS ─────────────────────────────────────────

  @Get('redeem')
  @ApiOperation({ summary: 'List redeem requests (filterable by status)' })
  async getRedeemRequests(@Query() query: RedeemQueryDto) {
    return this.gamiAdminService.getRedeemRequests(query);
  }

  @Put('redeem/:id/status')
  @ApiOperation({ summary: 'Update redeem request status' })
  async updateRedeemStatus(
    @Param('id') id: string,
    @Body() dto: RedeemStatusDto,
  ) {
    return this.gamiAdminService.updateRedeemStatus(id, dto.status, dto.note);
  }
}
