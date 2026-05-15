import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.init();
  }

  private async init() {
    const fcmKey = this.configService.get('FCM_SERVER_KEY');
    if (!fcmKey) {
      this.logger.warn('FCM_SERVER_KEY not configured — push notifications will be logged only');
      return;
    }
    this.initialized = true;
    this.logger.log('Push notification service initialized (FCM)');
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    // Look up device tokens for this user
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
    });

    if (devices.length === 0) {
      this.logger.debug(`No active device tokens for user ${userId}`);
      return { sent: 0 };
    }

    const tokens = devices.map((d: any) => d.token);
    return this.sendToTokens(tokens, title, body, data);
  }

  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!this.initialized) {
      this.logger.warn(`[DEV] Push → ${tokens.length} devices | ${title}: ${body}`);
      return { sent: 0, detail: 'FCM not configured' };
    }

    const fcmKey = this.configService.get('FCM_SERVER_KEY');
    let sent = 0;

    for (const token of tokens) {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            Authorization: `key=${fcmKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body },
            data: data || {},
          }),
        });

        const result = await response.json();

        if (result.success === 1) {
          sent++;
        } else if (result.results?.[0]?.error === 'NotRegistered') {
          // Token is stale, deactivate it
          await this.prisma.deviceToken.updateMany({
            where: { token },
            data: { isActive: false },
          });
          this.logger.debug(`Deactivated stale FCM token: ${token.slice(0, 20)}...`);
        }
      } catch (err) {
        this.logger.error(`FCM send failed for token ${token.slice(0, 20)}...: ${err}`);
      }
    }

    this.logger.log(`Push sent to ${sent}/${tokens.length} devices`);
    return { sent, total: tokens.length };
  }

  // ─── DEVICE TOKEN MANAGEMENT ──────────────────────────────

  async registerToken(userId: string, token: string, platform: string) {
    // Upsert: if token exists for this user, update; otherwise create
    const existing = await this.prisma.deviceToken.findFirst({
      where: { token },
    });

    if (existing) {
      return this.prisma.deviceToken.update({
        where: { id: existing.id },
        data: { userId, platform, isActive: true, updatedAt: new Date() },
      });
    }

    return this.prisma.deviceToken.create({
      data: { userId, token, platform, isActive: true },
    });
  }

  async removeToken(token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
    return { message: 'Device token dihapus' };
  }
}
