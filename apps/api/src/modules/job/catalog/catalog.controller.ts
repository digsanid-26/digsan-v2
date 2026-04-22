import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('Job - Catalog')
@Controller('jobs/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get all job categories (3-level hierarchy)' })
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'Get category by slug with subcategories' })
  async getCategoryBySlug(@Param('slug') slug: string) {
    return this.catalogService.getCategoryBySlug(slug);
  }

  @Get('services')
  @ApiOperation({ summary: 'Get services with optional filters' })
  async getServices(@Query() query: any) {
    return this.catalogService.getServices(query);
  }

  @Get('services/:slug')
  @ApiOperation({ summary: 'Get service detail by slug' })
  async getServiceBySlug(@Param('slug') slug: string) {
    return this.catalogService.getServiceBySlug(slug);
  }
}
