import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly PREFIX = 'bl:';

  // In-memory fallback when Redis is unavailable
  private memoryBlacklist = new Map<string, number>();

  constructor(private redis: RedisService) {}

  /**
   * Blacklist a JWT token (access or refresh) until its expiry.
   * @param token - the JWT token string
   * @param expiresInSeconds - TTL, after which the entry auto-removes
   */
  async blacklist(token: string, expiresInSeconds: number): Promise<void> {
    const key = `${this.PREFIX}${this.hash(token)}`;

    if (this.redis.isConnected()) {
      await this.redis.set(key, '1', expiresInSeconds);
    } else {
      this.memoryBlacklist.set(key, Date.now() + expiresInSeconds * 1000);
      this.cleanupMemory();
    }
  }

  /**
   * Check if a token has been blacklisted.
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const key = `${this.PREFIX}${this.hash(token)}`;

    if (this.redis.isConnected()) {
      return this.redis.exists(key);
    }

    // Fallback: in-memory check
    const expiry = this.memoryBlacklist.get(key);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.memoryBlacklist.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Simple hash to avoid storing full JWT as Redis key.
   */
  private hash(token: string): string {
    // Use last 32 chars of token as a fingerprint (unique enough for blacklist)
    return token.slice(-32);
  }

  private cleanupMemory() {
    if (this.memoryBlacklist.size > 10000) {
      const now = Date.now();
      for (const [key, expiry] of this.memoryBlacklist) {
        if (now > expiry) this.memoryBlacklist.delete(key);
      }
    }
  }
}
