import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private connected = false;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    this.client = createClient({ url }) as RedisClientType;

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err}`);
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.connected = true;
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis connection failed (falling back to in-memory): ${err.message}`);
    });
  }

  async onModuleDestroy() {
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
