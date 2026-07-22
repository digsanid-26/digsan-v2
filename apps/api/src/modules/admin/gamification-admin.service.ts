import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GamificationAdminService {
  constructor(private prisma: PrismaService) {}

  // ─── POINT TYPES (Gami Konfigurasi) ──────────────────────────

  async getPointTypes() {
    return this.prisma.pointType.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createPointType(data: { name: string; label: string; description?: string; icon?: string; color?: string }) {
    const existing = await this.prisma.pointType.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('Tipe poin dengan nama ini sudah ada');
    return this.prisma.pointType.create({ data });
  }

  async updatePointType(id: string, data: { label?: string; description?: string; icon?: string; color?: string; isActive?: boolean }) {
    const pt = await this.prisma.pointType.findUnique({ where: { id } });
    if (!pt) throw new NotFoundException('Tipe poin tidak ditemukan');
    return this.prisma.pointType.update({ where: { id }, data });
  }

  async deletePointType(id: string) {
    const pt = await this.prisma.pointType.findUnique({ where: { id } });
    if (!pt) throw new NotFoundException('Tipe poin tidak ditemukan');
    await this.prisma.pointType.delete({ where: { id } });
    return { message: 'Tipe poin dihapus' };
  }

  // ─── STATS & LOGS ────────────────────────────────────────────

  async getStats() {
    const [totalPoints, totalUsers, pointTypeStats] = await Promise.all([
      this.prisma.point.aggregate({ _sum: { amount: true } }),
      this.prisma.point.groupBy({ by: ['userId'], _sum: { amount: true } }).then((r) => r.length),
      this.prisma.point.groupBy({
        by: ['type'],
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
    ]);

    return {
      totalPointsAwarded: totalPoints._sum.amount || 0,
      totalUsersWithPoints: totalUsers,
      pointTypeStats: pointTypeStats.map((s: any) => ({
        type: s.type,
        totalAmount: s._sum.amount || 0,
        transactionCount: s._count._all,
      })),
    };
  }

  async getPointLogs(query: {
    page?: number;
    limit?: number;
    type?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PointWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.userId) where.userId = query.userId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [points, total] = await this.prisma.$transaction([
      this.prisma.point.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
      this.prisma.point.count({ where }),
    ]);

    return { points, total, page, limit };
  }

  async getTopUsers(type?: string, limit: number = 10) {
    const where: Prisma.PointWhereInput = {};
    if (type) where.type = type;

    const leaderboard = await this.prisma.point.groupBy({
      by: ['userId'],
      where,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const userIds = leaderboard.map((e: any) => e.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatar: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return leaderboard.map((entry: any, index: number) => ({
      rank: index + 1,
      userId: entry.userId,
      name: userMap.get(entry.userId)?.name || 'Unknown',
      email: userMap.get(entry.userId)?.email || '',
      avatar: userMap.get(entry.userId)?.avatar || null,
      totalPoints: entry._sum.amount || 0,
    }));
  }

  // ─── REWARDS ─────────────────────────────────────────────────

  async getRewards() {
    return this.prisma.reward.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redeemRequests: true } },
      },
    });
  }

  async createReward(data: { name: string; description?: string; icon?: string; pointCost: number; stock?: number }) {
    return this.prisma.reward.create({ data });
  }

  async updateReward(id: string, data: { name?: string; description?: string; icon?: string; pointCost?: number; stock?: number; isActive?: boolean }) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Reward tidak ditemukan');
    return this.prisma.reward.update({ where: { id }, data });
  }

  async deleteReward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Reward tidak ditemukan');
    await this.prisma.reward.delete({ where: { id } });
    return { message: 'Reward dihapus' };
  }

  // ─── REDEEM REQUESTS ─────────────────────────────────────────

  async getRedeemRequests(query: { status?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.RedeemRequestWhereInput = {};
    if (query.status) where.status = query.status as any;

    const [requests, total] = await this.prisma.$transaction([
      this.prisma.redeemRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          reward: { select: { id: true, name: true, pointCost: true, icon: true } },
        },
      }),
      this.prisma.redeemRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
  }

  async updateRedeemStatus(id: string, status: string, note?: string) {
    const request = await this.prisma.redeemRequest.findUnique({
      where: { id },
      include: { reward: true, user: true },
    });
    if (!request) throw new NotFoundException('Permintaan redeem tidak ditemukan');

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'];
    if (!validStatuses.includes(status)) throw new BadRequestException('Status tidak valid');

    return this.prisma.redeemRequest.update({
      where: { id },
      data: { status: status as any, note: note ?? request.note },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reward: { select: { id: true, name: true, pointCost: true } },
      },
    });
  }
}
