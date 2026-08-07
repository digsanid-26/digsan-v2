import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from '../notification/email.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { GamificationService } from '../gamification/gamification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private whatsappService: WhatsappService,
    private gamification: GamificationService,
  ) {}

  // ─── REGISTER ──────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar');
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Nomor telepon sudah terdaftar');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        phone: dto.phone || null,
        isWhatsapp: dto.isWhatsapp || false,
        status: 'PENDING',
      },
    });

    // Create email verification token
    const emailToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: emailToken,
        type: 'EMAIL',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email (fire-and-forget)
    this.emailService
      .sendVerificationEmail(user.email, user.name, emailToken)
      .catch((err) => this.logger.error(`Failed to send verification email: ${err.message}`));

    // Send WhatsApp OTP if phone provided and is WhatsApp
    if (dto.phone && dto.isWhatsapp) {
      const otp = this.whatsappService.generateOTP(6);
      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          token: otp,
          type: 'WHATSAPP',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });
      this.whatsappService
        .sendOTP(dto.phone, otp, user.name)
        .catch((err) => this.logger.error(`Failed to send WA OTP: ${err.message}`));
    }

    // Assign default 'user' role
    const userRole = await this.prisma.role.findUnique({ where: { name: 'user' } });
    if (userRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: userRole.id },
      });
    }

    return {
      message: 'Registrasi berhasil. Silakan verifikasi email Anda.',
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  // ─── LOGIN ─────────────────────────────────────────────────

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string; device?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      await this.logLogin(null, dto.email, 'FAILED', 'User not found', meta);
      throw new UnauthorizedException('Email atau password salah');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.logLogin(user.id, dto.email, 'FAILED', 'Wrong password', meta);
      throw new UnauthorizedException('Email atau password salah');
    }

    if (user.status === 'PENDING') {
      await this.logLogin(user.id, dto.email, 'FAILED', 'Email not verified', meta);
      throw new UnauthorizedException('Email belum diverifikasi');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      await this.logLogin(user.id, dto.email, 'BLOCKED', `Account ${user.status}`, meta);
      throw new UnauthorizedException('Akun Anda telah ditangguhkan');
    }

    // EARLY_ACCESS and ACTIVE users can login
    if (user.status !== 'ACTIVE' && user.status !== 'EARLY_ACCESS') {
      await this.logLogin(user.id, dto.email, 'FAILED', `Status: ${user.status}`, meta);
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    // Store refresh token in DB
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.logLogin(user.id, dto.email, 'SUCCESS', null, meta);

    // Award daily login points (non-blocking, ignores errors)
    this.gamification.awardLoginPoints(user.id).catch((err) => {
      this.logger.error(`Failed to award login points: ${err}`);
    });

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: { select: { name: true } } },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        status: user.status,
        roles: userRoles.map((ur) => ur.role.name),
      },
      ...tokens,
    };
  }

  // ─── WHATSAPP LOGIN ────────────────────────────────────────

  /**
   * Sends a WhatsApp OTP to the given phone number for login.
   * The user must already exist with that phone number.
   */
  async sendWhatsappLoginOTP(phone: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('Nomor WhatsApp tidak ditemukan');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException('Akun Anda telah ditangguhkan');
    }

    if (user.status === 'PENDING') {
      throw new UnauthorizedException('Akun belum diverifikasi');
    }

    const otp = this.whatsappService.generateOTP(6);
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token: otp,
        type: 'WHATSAPP',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    this.whatsappService
      .sendOTP(phone, otp, user.name)
      .catch((err) => this.logger.error(`Failed to send WA login OTP: ${err.message}`));

    await this.logLogin(user.id, user.email, 'SUCCESS', 'WA OTP sent', meta);

    return { message: 'Kode OTP telah dikirim ke WhatsApp Anda' };
  }

  /**
   * Verifies the WhatsApp OTP and logs the user in.
   */
  async verifyWhatsappLogin(phone: string, otp: string, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new UnauthorizedException('Nomor WhatsApp tidak ditemukan');
    }

    const verification = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        token: otp,
        type: 'WHATSAPP',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new UnauthorizedException('Kode OTP salah atau kadaluarsa');
    }

    // Delete used token
    await this.prisma.verificationToken.delete({ where: { id: verification.id } });

    if (user.status !== 'ACTIVE' && user.status !== 'EARLY_ACCESS') {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.logLogin(user.id, user.email, 'SUCCESS', 'WhatsApp OTP login', meta);

    this.gamification.awardLoginPoints(user.id).catch((err) => {
      this.logger.error(`Failed to award login points: ${err}`);
    });

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: { select: { name: true } } },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        status: user.status,
        roles: userRoles.map((ur) => ur.role.name),
      },
      ...tokens,
    };
  }

  // ─── VERIFY EMAIL ──────────────────────────────────────────

  async verifyEmail(token: string) {
    const verification = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'EMAIL',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new BadRequestException('Token tidak valid atau sudah kadaluarsa');
    }

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: verification.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: verification.userId },
        data: {
          emailVerified: new Date(),
          status: 'ACTIVE',
        },
      }),
    ]);

    // Award new_account points (non-blocking)
    this.gamification.awardRegistrationPoints(verification.userId).catch((err) => {
      this.logger.error(`Failed to award new_account points: ${err}`);
    });

    return { message: 'Email berhasil diverifikasi' };
  }

  // ─── VERIFY WHATSAPP ──────────────────────────────────────

  async verifyWhatsapp(userId: string, otp: string) {
    const verification = await this.prisma.verificationToken.findFirst({
      where: {
        userId,
        token: otp,
        type: 'WHATSAPP',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      // Increment attempts on all matching unused tokens
      await this.prisma.verificationToken.updateMany({
        where: { userId, type: 'WHATSAPP', used: false },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Kode OTP tidak valid atau sudah kadaluarsa');
    }

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: verification.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { phoneVerified: new Date() },
      }),
    ]);

    return { message: 'WhatsApp berhasil diverifikasi' };
  }

  // ─── RESEND VERIFICATION ──────────────────────────────────

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'Jika email terdaftar, email verifikasi telah dikirim ulang.' };
    }
    if (user.emailVerified) {
      throw new BadRequestException('Email sudah diverifikasi');
    }

    // Invalidate old tokens
    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: 'EMAIL', used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: 'EMAIL',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    this.emailService
      .sendVerificationEmail(user.email, user.name, token)
      .catch((err) => this.logger.error(`Failed to resend verification email: ${err.message}`));

    return { message: 'Jika email terdaftar, email verifikasi telah dikirim ulang.' };
  }

  async resendWhatsappOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    if (!user.phone) throw new BadRequestException('Nomor telepon belum diisi');
    if (user.phoneVerified) throw new BadRequestException('WhatsApp sudah diverifikasi');

    // Invalidate old OTP tokens
    await this.prisma.verificationToken.updateMany({
      where: { userId, type: 'WHATSAPP', used: false },
      data: { used: true },
    });

    const otp = this.whatsappService.generateOTP(6);
    await this.prisma.verificationToken.create({
      data: {
        userId,
        token: otp,
        type: 'WHATSAPP',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    this.whatsappService
      .sendOTP(user.phone, otp, user.name)
      .catch((err) => this.logger.error(`Failed to resend WA OTP: ${err.message}`));

    return { message: 'Kode OTP WhatsApp telah dikirim ulang.' };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Jika email terdaftar, link reset password telah dikirim.' };
    }

    // Invalidate old password reset tokens
    await this.prisma.verificationToken.updateMany({
      where: { userId: user.id, type: 'PASSWORD_RESET', used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    this.emailService
      .sendPasswordResetEmail(user.email, user.name, token)
      .catch((err) => this.logger.error(`Failed to send reset email: ${err.message}`));

    return { message: 'Jika email terdaftar, link reset password telah dikirim.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const verification = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: 'PASSWORD_RESET',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new BadRequestException('Token tidak valid atau sudah kadaluarsa');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: verification.id },
        data: { used: true },
      }),
      this.prisma.user.update({
        where: { id: verification.userId },
        data: { passwordHash },
      }),
      // Invalidate all refresh tokens for security
      this.prisma.refreshToken.deleteMany({
        where: { userId: verification.userId },
      }),
    ]);

    return { message: 'Password berhasil direset. Silakan login kembali.' };
  }

  // ─── REFRESH TOKEN ─────────────────────────────────────────

  async refreshToken(token: string) {
    // Check token exists in DB
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      throw new UnauthorizedException('Refresh token tidak valid atau sudah kadaluarsa');
    }

    // Verify JWT
    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    // Rotate: delete old, generate new
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const tokens = await this.generateTokens(payload.sub, payload.email);
    await this.storeRefreshToken(payload.sub, tokens.refreshToken);

    return tokens;
  }

  // ─── LOGOUT ────────────────────────────────────────────────

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    return { message: 'Berhasil logout' };
  }

  // ─── GOOGLE OAUTH ─────────────────────────────────────────

  async googleLogin(profile: {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      // Check if email already exists (link accounts)
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        // Link Google to existing account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            avatar: user.avatar || profile.avatar,
            emailVerified: user.emailVerified || new Date(),
            status: 'ACTIVE',
          },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            avatar: profile.avatar,
            provider: 'google',
            emailVerified: new Date(),
            status: 'ACTIVE',
          },
        });

        // Assign default role
        const userRole = await this.prisma.role.findUnique({ where: { name: 'user' } });
        if (userRole) {
          await this.prisma.userRole.create({
            data: { userId: user.id, roleId: userRole.id },
          });
        }

        // Award new_account points for Google signup
        this.gamification.awardRegistrationPoints(user.id).catch((err) => {
          this.logger.error(`Failed to award new_account points: ${err}`);
        });
      }
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Award daily login points (non-blocking)
    this.gamification.awardLoginPoints(user.id).catch((err) => {
      this.logger.error(`Failed to award login points: ${err}`);
    });

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: { select: { name: true } } },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        roles: userRoles.map((ur) => ur.role.name),
      },
      ...tokens,
    };
  }

  // ─── EARLY ACCESS IMPERSONATION ────────────────────────────

  /**
   * Lets a super_user sign in as one of the EARLY_ACCESS members they created,
   * so they can fill in that person's general profile (babies, minors, the
   * deceased) without that member ever verifying an account.
   *
   * Guarded on three fronts: the caller must hold super_user, must own the tree
   * the node belongs to, and the target account must still be EARLY_ACCESS.
   */
  async loginAsEarlyAccessNode(
    superUserId: string,
    nodeId: string,
    slug: string | undefined,
    meta?: { ip?: string; userAgent?: string; device?: string },
  ) {
    const callerRoles = await this.prisma.userRole.findMany({
      where: { userId: superUserId },
      include: { role: { select: { name: true } } },
    });
    if (!callerRoles.some((ur) => ur.role.name === 'super_user')) {
      throw new ForbiddenException('Hanya super_user yang dapat login early access');
    }

    const tree = slug
      ? await this.prisma.familyTree.findUnique({ where: { slug } })
      : await this.prisma.familyTree.findFirst({ where: { userId: superUserId }, orderBy: { createdAt: 'asc' } });
    if (!tree) throw new NotFoundException('Keluarga tidak ditemukan');
    if (tree.userId !== superUserId) {
      throw new ForbiddenException('Anda bukan pengelola keluarga ini');
    }

    const node = ((tree.layoutMembers as Record<string, any>) ?? {})[nodeId];
    if (!node?.linkedUserId) {
      throw new BadRequestException('Node ini belum memiliki early access');
    }

    const target = await this.prisma.user.findUnique({ where: { id: node.linkedUserId } });
    if (!target) throw new NotFoundException('Akun early access tidak ditemukan');
    if (target.status !== 'EARLY_ACCESS') {
      throw new ForbiddenException('Akun ini sudah aktif — login harus dilakukan pemiliknya sendiri');
    }

    const tokens = await this.generateTokens(target.id, target.email);
    await this.storeRefreshToken(target.id, tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: target.id },
      data: { lastLoginAt: new Date() },
    });
    await this.logLogin(target.id, target.email, 'SUCCESS', `Early access via super_user ${superUserId}`, meta);

    const targetRoles = await this.prisma.userRole.findMany({
      where: { userId: target.id },
      include: { role: { select: { name: true } } },
    });

    return {
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        username: target.username,
        avatar: target.avatar,
        status: target.status,
        roles: targetRoles.map((ur) => ur.role.name),
      },
      nodeId,
      familySlug: tree.slug,
      ...tokens,
    };
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '7d'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });

    // Cleanup: keep only last 5 refresh tokens per user
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
    });
    if (tokens.length > 0) {
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: tokens.map((t: any) => t.id) } },
      });
    }
  }

  private async logLogin(
    userId: string | null,
    identifier: string,
    status: 'SUCCESS' | 'FAILED' | 'BLOCKED',
    reason: string | null,
    meta?: { ip?: string; userAgent?: string; device?: string },
  ) {
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId,
          identifier,
          status,
          reason,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          device: meta?.device,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log login: ${err}`);
    }
  }
}
