import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/database/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        phone: true,
        isWhatsapp: true,
        emailVerified: true,
        phoneVerified: true,
        status: true,
        provider: true,
        lastLoginAt: true,
        createdAt: true,
        birthDate: true,
        birthPlace: true,
        education: true,
        occupation: true,
        hobbies: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return {
      ...user,
      roles: user.userRoles.map((ur: any) => ur.role.name),
      userRoles: undefined,
    };
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // If changing phone, check uniqueness
    if (dto.phone) {
      const existing = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: userId } },
      });
      if (existing) {
        throw new BadRequestException('Nomor telepon sudah digunakan');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isWhatsapp !== undefined && { isWhatsapp: dto.isWhatsapp }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.birthPlace !== undefined && { birthPlace: dto.birthPlace }),
        ...(dto.education !== undefined && { education: dto.education }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.hobbies !== undefined && { hobbies: dto.hobbies }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        phone: true,
        isWhatsapp: true,
        birthDate: true,
        birthPlace: true,
        education: true,
        occupation: true,
        hobbies: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, provider: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Akun ini menggunakan login Google. Set password melalui forgot-password.',
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Password saat ini salah');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal 6 karakter');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password berhasil diubah' };
  }

  /**
   * User requests upgrade to super_user role.
   * Sends notification + email to all super_admins.
   */
  async requestSuperUserUpgrade(userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    // Check if already super_user
    const existingRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { name: 'super_user' },
      },
    });
    if (existingRole) {
      throw new BadRequestException('Anda sudah memiliki role super_user');
    }

    // Find all super_admin users to notify
    const superAdmins = await this.prisma.userRole.findMany({
      where: { role: { name: 'super_admin' } },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    // Create notification for each super_admin
    for (const admin of superAdmins) {
      await this.notifications.create({
        userId: admin.user.id,
        type: 'SYSTEM' as any,
        title: 'Permintaan Upgrade Super User',
        message: `${user.name} (${user.email}) meminta untuk menjadi super_user. Alasan: ${reason}`,
        data: { requestingUserId: user.id, requestingUserName: user.name, requestingUserEmail: user.email, reason },
      }).catch((err) => this.logger.error(`Failed to notify admin ${admin.user.id}: ${err.message}`));

      this.notifications.sendPushSafe(
        admin.user.id,
        'Permintaan Upgrade Super User',
        `${user.name} meminta menjadi super_user`,
      ).catch(() => {});
    }

    return {
      message: 'Permintaan upgrade super_user telah dikirim ke admin',
      requestedBy: { id: user.id, name: user.name, email: user.email },
      notifiedAdmins: superAdmins.length,
    };
  }

  async searchUsers(query: string, limit: number = 20) {
    const q = query.trim();
    if (!q) return { users: [] };

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar: true,
      },
      take: limit,
    });

    return { users };
  }

  async submitFeedback(userId: string, category: string, message: string) {
    if (!message?.trim()) throw new BadRequestException('Pesan tidak boleh kosong');
    const valid = ['saran', 'bug', 'pertanyaan'];
    if (!valid.includes(category)) throw new BadRequestException('Kategori tidak valid');

    const feedback = await this.prisma.feedback.create({
      data: { userId, category, message: message.trim() },
    });

    this.logger.log(`Feedback from ${userId}: [${category}] ${message.slice(0, 60)}...`);
    return { id: feedback.id, success: true };
  }
}
