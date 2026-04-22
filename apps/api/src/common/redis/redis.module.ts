import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { SessionService } from './session.service';

@Global()
@Module({
  providers: [RedisService, TokenBlacklistService, SessionService],
  exports: [RedisService, TokenBlacklistService, SessionService],
})
export class RedisModule {}
