import { Controller, Get, Put, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { NotificationQueryDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user (paginated)' })
  async findAll(@CurrentUser('id') userId: string, @Query() query: NotificationQueryDto) {
    return this.notificationService.findAll(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationService.unreadCount(userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationService.getPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preference' })
  async setPreference(
    @CurrentUser('id') userId: string,
    @Body() body: { type: string; channel: string; enabled: boolean },
  ) {
    return this.notificationService.setPreference(userId, body.type, body.channel, body.enabled);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllAsRead(userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationService.markAsRead(id, userId);
  }

  // ─── DEVICE TOKEN ─────────────────────────────────────────

  @Post('device-token')
  @ApiOperation({ summary: 'Register device token for push notifications' })
  async registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() body: { token: string; platform?: string },
  ) {
    return this.pushService.registerToken(userId, body.token, body.platform || 'android');
  }

  @Delete('device-token/:token')
  @ApiOperation({ summary: 'Remove device token' })
  async removeDeviceToken(@Param('token') token: string) {
    return this.pushService.removeToken(token);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationService.remove(id, userId);
  }
}

// ─── Admin notification config ──────────────────────────────

@ApiTags('Admin - Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'super_admin')
@Controller('admin/notifications')
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get all notification settings (admin)' })
  async getSettings() {
    return this.notificationService.getAllSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update notification setting (admin)' })
  async upsertSetting(@Body() body: { type: string; channel: string; enabled: boolean }) {
    return this.notificationService.upsertSetting(body.type, body.channel, body.enabled);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics (admin)' })
  async getStats() {
    return this.notificationService.getNotificationStats();
  }
}
