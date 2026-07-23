import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdvertisingAdminService } from './advertising-admin.service';

@ApiTags('Admin/Advertising')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'super_admin')
@Controller('admin/ads')
export class AdvertisingAdminController {
  constructor(private readonly adsService: AdvertisingAdminService) {}

  // ─── DASHBOARD ────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get advertising dashboard stats' })
  async getStats() {
    return this.adsService.getStats();
  }

  // ─── SPOTS ────────────────────────────────────────────────

  @Get('spots')
  @ApiOperation({ summary: 'List all ad spots' })
  async listSpots() {
    return this.adsService.listSpots();
  }

  @Post('spots')
  @ApiOperation({ summary: 'Create a new ad spot' })
  async createSpot(@Body() data: { key: string; label: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number }) {
    return this.adsService.createSpot(data);
  }

  @Put('spots/:id')
  @ApiOperation({ summary: 'Update an ad spot' })
  async updateSpot(@Param('id') id: string, @Body() data: { label?: string; description?: string; page?: string; position?: string; aspectRatio?: string; maxSlots?: number; isActive?: boolean }) {
    return this.adsService.updateSpot(id, data);
  }

  @Delete('spots/:id')
  @ApiOperation({ summary: 'Delete an ad spot' })
  async deleteSpot(@Param('id') id: string) {
    return this.adsService.deleteSpot(id);
  }

  // ─── BANNERS ──────────────────────────────────────────────

  @Get('banners')
  @ApiOperation({ summary: 'List all ad banners' })
  async listBanners() {
    return this.adsService.listBanners();
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a new ad banner' })
  async createBanner(@CurrentUser('id') userId: string, @Body() data: { title: string; imageUrl: string; linkUrl?: string; aspectRatio?: string; width?: number; height?: number; isAiGenerated?: boolean; aiPrompt?: string }) {
    return this.adsService.createBanner(userId, data);
  }

  @Put('banners/:id')
  @ApiOperation({ summary: 'Update an ad banner' })
  async updateBanner(@Param('id') id: string, @Body() data: { title?: string; imageUrl?: string; linkUrl?: string; aspectRatio?: string; width?: number; height?: number }) {
    return this.adsService.updateBanner(id, data);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete an ad banner' })
  async deleteBanner(@Param('id') id: string) {
    return this.adsService.deleteBanner(id);
  }

  // ─── ASSIGNMENTS ──────────────────────────────────────────

  @Get('assignments')
  @ApiOperation({ summary: 'List all ad assignments' })
  async listAssignments() {
    return this.adsService.listAssignments();
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Assign a banner to a spot' })
  async assignBanner(@CurrentUser('id') userId: string, @Body() data: { spotId: string; bannerId: string; startDate?: string; endDate?: string; rate?: number; discountRole?: string }) {
    return this.adsService.assignBanner(userId, data);
  }

  @Put('assignments/:id')
  @ApiOperation({ summary: 'Update an ad assignment' })
  async updateAssignment(@Param('id') id: string, @Body() data: { startDate?: string; endDate?: string; rate?: number; discountRole?: string; isActive?: boolean }) {
    return this.adsService.updateAssignment(id, data);
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete an ad assignment' })
  async deleteAssignment(@Param('id') id: string) {
    return this.adsService.deleteAssignment(id);
  }

  // ─── AI IMAGE GENERATION ──────────────────────────────────

  @Post('ai-generate')
  @ApiOperation({ summary: 'Generate an ad banner image using AI (OpenRouter)' })
  async generateAiImage(@Body() data: { prompt: string; includeText?: boolean; textContent?: string; fontFamily?: string; colorScheme?: string; aspectRatio?: string; style?: string }) {
    return this.adsService.generateAiImage(data);
  }
}
