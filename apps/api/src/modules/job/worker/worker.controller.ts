import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { WorkerService } from './worker.service';
import { RegisterWorkerDto, WorkerSkillDto, WorkScheduleDto, ServiceAreaDto } from './dto/register-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { SearchWorkerDto } from './dto/search-worker.dto';

@ApiTags('Job - Workers')
@Controller('jobs/workers')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  // ─── PUBLIC: SEARCH & VIEW ──────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Search workers with filters (public)' })
  async search(@Query() query: SearchWorkerDto) {
    return this.workerService.search(query);
  }

  @Get('profile/:id')
  @ApiOperation({ summary: 'Get worker profile by profile ID (public)' })
  async getProfile(@Param('id') id: string) {
    return this.workerService.getProfile(id);
  }

  // ─── AUTHENTICATED: REGISTRATION & MANAGEMENT ──────────────

  @Post('register')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Register as a worker/provider' })
  async register(@CurrentUser('id') userId: string, @Body() dto: RegisterWorkerDto) {
    return this.workerService.register(userId, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get my worker profile' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.workerService.getMyProfile(userId);
  }

  @Put('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update my worker profile' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateWorkerDto) {
    return this.workerService.updateProfile(userId, dto);
  }

  // ─── SKILLS ─────────────────────────────────────────────────

  @Post('me/skills')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Add a skill to my worker profile' })
  async addSkill(@CurrentUser('id') userId: string, @Body() dto: WorkerSkillDto) {
    return this.workerService.addSkill(userId, dto);
  }

  @Delete('me/skills/:skillId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Remove a skill from my worker profile' })
  async removeSkill(@CurrentUser('id') userId: string, @Param('skillId') skillId: string) {
    return this.workerService.removeSkill(userId, skillId);
  }

  // ─── SCHEDULE ───────────────────────────────────────────────

  @Put('me/schedule')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Replace work schedule (bulk)' })
  async updateSchedule(@CurrentUser('id') userId: string, @Body() dto: { schedules: WorkScheduleDto[] }) {
    return this.workerService.updateSchedule(userId, dto.schedules);
  }

  // ─── SERVICE AREAS ──────────────────────────────────────────

  @Put('me/areas')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Replace service areas (bulk)' })
  async updateServiceAreas(@CurrentUser('id') userId: string, @Body() dto: { areas: ServiceAreaDto[] }) {
    return this.workerService.updateServiceAreas(userId, dto.areas);
  }
}
