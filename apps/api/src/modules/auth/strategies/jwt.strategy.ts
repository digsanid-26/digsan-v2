import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../common/database/prisma.service';
import { TokenBlacklistService } from '../../../common/redis/token-blacklist.service';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private tokenBlacklist: TokenBlacklistService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'CHANGE_ME'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // Check if this access token has been blacklisted (e.g. after logout)
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (token && (await this.tokenBlacklist.isBlacklisted(token))) {
      throw new UnauthorizedException('Token telah di-revoke');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        status: true,
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }
}
