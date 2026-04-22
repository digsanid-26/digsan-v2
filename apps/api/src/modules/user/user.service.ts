import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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
      roles: user.userRoles.map((ur) => ur.role.name),
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
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        phone: true,
        isWhatsapp: true,
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
}
