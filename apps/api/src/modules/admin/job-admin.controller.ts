import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { JobAdminService } from './job-admin.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
  CreateServiceDto,
  UpdateServiceDto,
  AdminAssignProviderDto,
  AdminUpdateOrderStatusDto,
} from './dto/job-admin.dto';

@ApiTags('Admin - Job')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'super_admin')
@Controller('admin/jobs')
export class JobAdminController {
  constructor(private readonly jobAdminService: JobAdminService) {}

  // ─── CATEGORY ──────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List all categories (admin)' })
  async getCategories(@Query('search') search?: string) {
    return this.jobAdminService['prisma'].jobCategory.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
      include: {
        subCategories: {
          include: { _count: { select: { services: true } } },
        },
        _count: { select: { subCategories: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.jobAdminService.createCategory(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.jobAdminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category' })
  async deleteCategory(@Param('id') id: string) {
    return this.jobAdminService.deleteCategory(id);
  }

  // ─── SUB-CATEGORY ──────────────────────────────────────────

  @Get('sub-categories')
  @ApiOperation({ summary: 'List all sub-categories (admin)' })
  async getSubCategories(@Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    return this.jobAdminService['prisma'].jobSubCategory.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { services: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  @Post('sub-categories')
  @ApiOperation({ summary: 'Create sub-category' })
  async createSubCategory(@Body() dto: CreateSubCategoryDto) {
    return this.jobAdminService.createSubCategory(dto);
  }

  @Put('sub-categories/:id')
  @ApiOperation({ summary: 'Update sub-category' })
  async updateSubCategory(@Param('id') id: string, @Body() dto: UpdateSubCategoryDto) {
    return this.jobAdminService.updateSubCategory(id, dto);
  }

  @Delete('sub-categories/:id')
  @ApiOperation({ summary: 'Delete sub-category' })
  async deleteSubCategory(@Param('id') id: string) {
    return this.jobAdminService.deleteSubCategory(id);
  }

  // ─── SERVICE ───────────────────────────────────────────────

  @Get('services')
  @ApiOperation({ summary: 'List all services (admin)' })
  async getServices(
    @Query('subCategoryId') subCategoryId?: string,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
  ) {
    const where: any = {};
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (featured === 'true') where.isFeatured = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.jobAdminService['prisma'].jobService.findMany({
      where,
      include: {
        subCategory: {
          select: { id: true, name: true, category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  @Post('services')
  @ApiOperation({ summary: 'Create service' })
  async createService(@Body() dto: CreateServiceDto) {
    return this.jobAdminService.createService(dto);
  }

  @Put('services/:id')
  @ApiOperation({ summary: 'Update service' })
  async updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.jobAdminService.updateService(id, dto);
  }

  @Delete('services/:id')
  @ApiOperation({ summary: 'Delete service' })
  async deleteService(@Param('id') id: string) {
    return this.jobAdminService.deleteService(id);
  }

  // ─── ORDER MANAGEMENT ──────────────────────────────────────

  @Put('orders/:id/assign-provider')
  @ApiOperation({ summary: 'Assign provider to an order' })
  async assignProvider(@Param('id') orderId: string, @Body() dto: AdminAssignProviderDto) {
    return this.jobAdminService.assignProvider(orderId, dto.providerId);
  }

  @Put('orders/:id/status')
  @ApiOperation({ summary: 'Admin override order status' })
  async updateOrderStatus(@Param('id') orderId: string, @Body() dto: AdminUpdateOrderStatusDto) {
    return this.jobAdminService.updateOrderStatus(orderId, dto.status, dto.notes);
  }

  // ─── PAYMENT MANAGEMENT ────────────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'List all payments (admin)' })
  async getPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.jobAdminService.getPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      search,
    });
  }
}
