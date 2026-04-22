import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface SessionData {
  userId: string;
  email: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly PREFIX = 'sess:';
  private readonly DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 days

  constructor(private redis: RedisService) {}

  /**
   * Create a session entry keyed by refresh token ID.
   */
  async create(sessionId: string, data: SessionData, ttlSeconds?: number): Promise<void> {
    const key = `${this.PREFIX}${sessionId}`;
    await this.redis.set(key, JSON.stringify(data), ttlSeconds || this.DEFAULT_TTL);
  }

  /**
   * Get session data.
   */
  async get(sessionId: string): Promise<SessionData | null> {
    const key = `${this.PREFIX}${sessionId}`;
    const raw = await this.redis.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Destroy a single session.
   */
  async destroy(sessionId: string): Promise<void> {
    const key = `${this.PREFIX}${sessionId}`;
    await this.redis.del(key);
  }

  /**
   * Destroy all sessions for a user.
   */
  async destroyAllForUser(userId: string): Promise<void> {
    // This requires scanning — works with Redis, no-op without
    const keys = await this.redis.keys(`${this.PREFIX}*`);
    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) {
        try {
          const data: SessionData = JSON.parse(raw);
          if (data.userId === userId) {
            await this.redis.del(key);
          }
        } catch {
          // skip malformed entries
        }
      }
    }
  }
}
