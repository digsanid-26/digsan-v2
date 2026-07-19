import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly redisUrl: string;

  constructor(private configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = createClient({ url: this.redisUrl }) as RedisClientType;

    this.client.on('error', (err) => {
      const msg = String(err?.message || err);
      // NOAUTH means the Redis server requires a password that wasn't provided.
      // Log once with actionable guidance instead of spamming on every operation.
      if (msg.includes('NOAUTH')) {
        this.logger.error(
          `Redis requires authentication (NOAUTH). Set REDIS_URL=redis://:password@host:6379 in .env`,
        );
      } else {
        this.logger.error(`Redis error: ${err}`);
      }
      this.connected = false;
      this.scheduleReconnect();
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.client.on('ready', () => {
      this.connected = true;
      this.logger.log('Redis ready');
    });

    this.client.on('end', () => {
      this.connected = false;
      this.scheduleReconnect();
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis connection failed (falling back to in-memory): ${err.message}`);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return; // already scheduled
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.logger.log('Attempting Redis reconnect…');
      this.client.connect().catch(() => {
        // Error handler will log; schedule another reconnect via 'end'/'error' events.
      });
    }, 5000);
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connected) {
      await this.client.quit();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.connected) return;
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.connected) return [];
    return this.client.keys(pattern);
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.connected) return;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}
