import {
  Controller, Get, Post, Body, Query, Req, Res, UseGuards, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { EmailSettingsService } from './email-settings.service';
import { SaveEmailCredentialsDto, SendTestEmailDto } from './dto/admin.dto';

@ApiTags('Admin Email')
@Controller('admin/email')
export class EmailSettingsController {
  constructor(
    private readonly service: EmailSettingsService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get email/Gmail connection status' })
  getStatus() {
    return this.service.getStatus();
  }

  @Post('credentials')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Save Google OAuth Client ID/Secret' })
  saveCredentials(@Body() dto: SaveEmailCredentialsDto) {
    return this.service.saveCredentials(dto.clientId, dto.clientSecret);
  }

  @Get('gmail/connect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get Google OAuth consent URL to connect a Gmail account' })
  connect(@Req() req: any) {
    const adminId = req.user?.id || req.user?.userId || req.user?.sub || 'admin';
    return this.service.buildConnectUrl(adminId);
  }

  // Public — Google redirects the browser here after consent (no bearer token).
  // The signed `state` param authorizes the exchange.
  @Get('gmail/callback')
  @ApiOperation({ summary: 'Google OAuth callback (public)' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
    try {
      if (error) throw new BadRequestException(error);
      if (!code) throw new BadRequestException('Kode otorisasi tidak ditemukan');
      const { email } = await this.service.handleCallback(code, state);
      return res.redirect(
        `${webUrl}/admin/settings?email=connected&addr=${encodeURIComponent(email)}`,
      );
    } catch (e: any) {
      return res.redirect(
        `${webUrl}/admin/settings?email=error&msg=${encodeURIComponent(e?.message || 'Gagal menghubungkan Gmail')}`,
      );
    }
  }

  @Post('gmail/disconnect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Disconnect the connected Gmail account' })
  disconnect() {
    return this.service.disconnect();
  }

  @Post('test')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Send a test email using the current configuration' })
  test(@Body() dto: SendTestEmailDto) {
    return this.service.sendTest(dto.to);
  }
}
