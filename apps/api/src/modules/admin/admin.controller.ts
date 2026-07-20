import { Controller, Get, Put, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  AdminUserQueryDto,
  UpdateUserStatusDto,
  AssignRoleDto,
  AdminWorkerQueryDto,
  UpdateWorkerStatusDto,
  AdminOrderQueryDto,
  UpdateSettingDto,
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'super_admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── DASHBOARD ────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ─── USER MANAGEMENT ──────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List users (paginated, filterable)' })
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  // ─── FAMILY TREE MANAGEMENT ────────────────────────────────

  @Get('trees')
  @ApiOperation({ summary: 'List family trees with slug, owner, and member count' })
  async getTrees(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('hasSlug') hasSlug?: string) {
    return this.adminService.getTrees({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      hasSlug,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user detail' })
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user status' })
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto.status);
  }

  @Post('users/:id/roles')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.adminService.assignRole(id, dto.roleName);
  }

  @Delete('users/:id/roles/:roleName')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(@Param('id') id: string, @Param('roleName') roleName: string) {
    return this.adminService.removeRole(id, roleName);
  }

  // ─── WORKER MANAGEMENT ────────────────────────────────────

  @Get('workers')
  @ApiOperation({ summary: 'List workers (paginated, filterable)' })
  async getWorkers(@Query() query: AdminWorkerQueryDto) {
    return this.adminService.getWorkers(query);
  }

  @Put('workers/:id/status')
  @ApiOperation({ summary: 'Approve/reject/suspend worker' })
  async updateWorkerStatus(@Param('id') id: string, @Body() dto: UpdateWorkerStatusDto) {
    return this.adminService.updateWorkerStatus(id, dto.providerStatus, dto.reason);
  }

  // ─── ORDER MANAGEMENT ─────────────────────────────────────

  @Get('orders')
  @ApiOperation({ summary: 'List orders (paginated, filterable)' })
  async getOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.getOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail' })
  async getOrderDetail(@Param('id') id: string) {
    return this.adminService.getOrderDetail(id);
  }

  // ─── SYSTEM SETTINGS ──────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get all system settings' })
  async getSettings(@Query('category') category?: string) {
    return this.adminService.getSettings(category);
  }

  @Put('settings/:key')
  @ApiOperation({ summary: 'Update a system setting' })
  async updateSetting(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.adminService.updateSetting(key, dto.value);
  }

  // ─── APP CONFIG ───────────────────────────────────────────

  @Get('configs')
  @ApiOperation({ summary: 'Get all app configs' })
  async getAppConfigs(@Query('category') category?: string) {
    return this.adminService.getAppConfigs(category);
  }

  @Post('configs')
  @ApiOperation({ summary: 'Create app config' })
  async createAppConfig(@Body() dto: CreateAppConfigDto) {
    return this.adminService.createAppConfig(dto);
  }

  @Put('configs/:key')
  @ApiOperation({ summary: 'Update app config' })
  async updateAppConfig(@Param('key') key: string, @Body() dto: UpdateAppConfigDto) {
    return this.adminService.updateAppConfig(key, dto);
  }

  @Delete('configs/:key')
  @ApiOperation({ summary: 'Delete app config' })
  async deleteAppConfig(@Param('key') key: string) {
    return this.adminService.deleteAppConfig(key);
  }
}
