import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdvertisingAdminService } from '../admin/advertising-admin.service';

@ApiTags('Advertising')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ads')
export class AdvertisingController {
  constructor(private readonly adsService: AdvertisingAdminService) {}

  @Get('spot/:key')
  @ApiOperation({ summary: 'Get active banners for a specific spot key' })
  async getSpotBanners(@Param('key') key: string) {
    return this.adsService.getActiveBannersForSpot(key);
  }

  @Get('page/:page')
  @ApiOperation({ summary: 'Get all active ad spots for a page' })
  async getPageBanners(@Param('page') page: string) {
    return this.adsService.getActiveSpotsForPage(page);
  }
}
