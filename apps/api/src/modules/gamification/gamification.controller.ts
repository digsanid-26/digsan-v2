import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GamificationService } from './gamification.service';
import { PointHistoryQueryDto, LeaderboardQueryDto } from './dto/gamification.dto';

@ApiTags('Gamification')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  // ─── POINTS ─────────────────────────────────────────────────

  @Get('points/balance')
  @ApiOperation({ summary: 'Get current user point balance' })
  async getPointBalance(@CurrentUser() user: any) {
    return this.gamificationService.getPointBalance(user.id);
  }

  @Get('points/history')
  @ApiOperation({ summary: 'Get point history (paginated)' })
  async getPointHistory(@CurrentUser() user: any, @Query() query: PointHistoryQueryDto) {
    return this.gamificationService.getPointHistory(user.id, query);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get points leaderboard' })
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.gamificationService.getLeaderboard(query.limit);
  }

  // ─── BADGES ─────────────────────────────────────────────────

  @Get('badges')
  @ApiOperation({ summary: 'Get all available badges' })
  async getAllBadges() {
    return this.gamificationService.getAllBadges();
  }

  @Get('badges/me')
  @ApiOperation({ summary: 'Get current user earned badges' })
  async getMyBadges(@CurrentUser() user: any) {
    return this.gamificationService.getUserBadges(user.id);
  }
}
