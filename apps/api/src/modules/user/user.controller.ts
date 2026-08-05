import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by name, email, or username' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 20)' })
  async searchUsers(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.userService.searchUsers(q, limit ? parseInt(limit, 10) : 20);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.userService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  @Post('me/request-super-user')
  @ApiOperation({ summary: 'Request upgrade to super_user role (notifies super_admins)' })
  async requestSuperUserUpgrade(
    @CurrentUser('id') userId: string,
    @Body() body: { reason: string },
  ) {
    return this.userService.requestSuperUserUpgrade(userId, body.reason);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public user profile by ID' })
  async getPublicProfile(@Param('id') id: string) {
    return this.userService.getPublicProfile(id);
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit beta app feedback (saran/bug/pertanyaan)' })
  async submitFeedback(
    @CurrentUser('id') userId: string,
    @Body() body: { category: string; message: string },
  ) {
    return this.userService.submitFeedback(userId, body.category, body.message);
  }
}
