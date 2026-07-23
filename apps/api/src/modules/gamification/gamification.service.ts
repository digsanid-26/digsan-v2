import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // ─── POINTS ─────────────────────────────────────────────────

  async getPointBalance(userId: string) {
    const result = await this.prisma.point.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return { balance: result._sum.amount || 0 };
  }

  async getPointHistory(userId: string, query: { page?: number; limit?: number; type?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.type) where.type = query.type;

    const [points, total] = await this.prisma.$transaction([
      this.prisma.point.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.point.count({ where }),
    ]);

    return { points, total, page, limit };
  }

  async awardPoints(userId: string, amount: number, type: string, reason?: string, metadata?: any) {
    const point = await this.prisma.point.create({
      data: {
        userId,
        amount,
        type,
        reason,
        metadata,
      },
    });

    // Notify user of points received
    this.notifications.create({
      userId,
      type: 'POINT_RECEIVED' as any,
      title: 'Poin Diterima',
      message: `Anda mendapat +${amount} poin ${type}${reason ? ` — ${reason}` : ''}.`,
      data: { pointId: point.id, amount, type, reason },
    }).catch(() => {});

    // Check badge eligibility after awarding points
    await this.checkAndAwardBadges(userId);

    return point;
  }

  async getLeaderboard(limit: number = 10) {
    const leaderboard = await this.prisma.point.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    // Fetch user details for leaderboard entries
    const userIds = leaderboard.map((entry: any) => entry.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });

    const userMap = new Map(users.map((u: any) => [u.id, u]));

    return leaderboard.map((entry: any, index: number) => ({
      rank: index + 1,
      userId: entry.userId,
      name: (userMap.get(entry.userId) as any)?.name || 'Unknown',
      avatar: (userMap.get(entry.userId) as any)?.avatar || null,
      totalPoints: entry._sum.amount || 0,
    }));
  }

  // ─── BADGES ─────────────────────────────────────────────────

  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: {
          include: { requirements: true },
        },
      },
      orderBy: { earnedAt: 'desc' },
    });
  }

  async getAllBadges() {
    return this.prisma.badge.findMany({
      include: { requirements: true },
      orderBy: { name: 'asc' },
    });
  }

  async checkAndAwardBadges(userId: string) {
    const allBadges = await this.prisma.badge.findMany({
      include: { requirements: true },
    });

    const earnedBadgeIds = (
      await this.prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      })
    ).map((ub: any) => ub.badgeId);

    const unearnedBadges = allBadges.filter((b: any) => !earnedBadgeIds.includes(b.id));

    const awarded: string[] = [];

    for (const badge of unearnedBadges) {
      const eligible = await this.checkBadgeEligibility(userId, badge);
      if (eligible) {
        await this.prisma.userBadge.create({
          data: { userId, badgeId: badge.id },
        });
        awarded.push(badge.name);

        // Notify user of badge earned
        this.notifications.create({
          userId,
          type: 'BADGE_EARNED' as any,
          title: 'Badge Baru Diperoleh!',
          message: `Selamat! Anda mendapat badge "${badge.name}".`,
          data: { badgeId: badge.id, badgeName: badge.name },
        }).catch(() => {});
        this.notifications.sendPushSafe(userId, 'Badge Baru!', `Anda mendapat badge "${badge.name}"`).catch(() => {});
      }
    }

    return awarded;
  }

  private async checkBadgeEligibility(
    userId: string,
    badge: { id: string; requirements: { type: string; value: number; metadata: any }[] },
  ): Promise<boolean> {
    if (badge.requirements.length === 0) return false;

    for (const req of badge.requirements) {
      const met = await this.checkRequirement(userId, req);
      if (!met) return false;
    }

    return true;
  }

  private async checkRequirement(
    userId: string,
    req: { type: string; value: number; metadata: any },
  ): Promise<boolean> {
    switch (req.type) {
      case 'total_points': {
        const result = await this.prisma.point.aggregate({
          where: { userId },
          _sum: { amount: true },
        });
        return (result._sum.amount || 0) >= req.value;
      }

      case 'point_transactions': {
        const count = await this.prisma.point.count({ where: { userId } });
        return count >= req.value;
      }

      case 'login_streak': {
        // Count distinct login point days
        const loginPoints = await this.prisma.point.count({
          where: { userId, type: 'login' },
        });
        return loginPoints >= req.value;
      }

      case 'trees_created': {
        const treeCount = await this.prisma.familyTree.count({ where: { userId } });
        return treeCount >= req.value;
      }

      case 'orders_completed': {
        const orderCount = await this.prisma.jobOrder.count({
          where: { customerId: userId, status: 'COMPLETED' },
        }).catch(() => 0);
        return orderCount >= req.value;
      }

      case 'referrals': {
        const referralCount = await this.prisma.point.count({
          where: { userId, type: 'referral' },
        });
        return referralCount >= req.value;
      }

      default:
        return false;
    }
  }

  // ─── POINT AWARD HELPERS ────────────────────────────────────

  async awardLoginPoints(userId: string) {
    // Check if daily_login rule is enabled and get configured amount
    const loginRule = await this.prisma.gamiRule.findUnique({ where: { key: 'daily_login' } });
    if (!loginRule) {
      this.logger.warn('GamiRule daily_login not found in DB');
      return null;
    }
    if (!loginRule.isEnabled) {
      this.logger.log('GamiRule daily_login is disabled, skipping');
      return null;
    }
    if (loginRule.amount <= 0) {
      this.logger.log('GamiRule daily_login amount is 0, skipping');
      return null;
    }

    // Check if user already got login points today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingToday = await this.prisma.point.findFirst({
      where: {
        userId,
        type: loginRule.pointType,
        reason: 'Daily login bonus',
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existingToday) {
      this.logger.log(`User ${userId} already got login points today, skipping`);
      return null;
    }

    // Award daily login points
    this.logger.log(`Awarding ${loginRule.amount} login points to user ${userId}`);
    await this.awardPoints(userId, loginRule.amount, loginRule.pointType, 'Daily login bonus');

    // Send push notification
    this.notifications.sendPushSafe(userId, 'Poin Diterima', `Anda mendapat +${loginRule.amount} poin ${loginRule.pointType} dari login harian`).catch(() => {});

    // Check streak bonus
    const streakRule = await this.prisma.gamiRule.findUnique({ where: { key: 'streak_5_day' } });
    if (streakRule && streakRule.isEnabled && streakRule.streakDays && streakRule.bonusAmount && streakRule.bonusAmount > 0) {
      // Count consecutive days of login (including today)
      const streakDays = await this.calculateLoginStreak(userId, loginRule.pointType);
      if (streakDays >= streakRule.streakDays) {
        // Check if streak bonus already awarded for this streak cycle
        const streakBonusKey = `streak_bonus_${streakRule.streakDays}_${Math.floor(streakDays / streakRule.streakDays)}`;
        const existingBonus = await this.prisma.point.findFirst({
          where: { userId, type: streakRule.pointType, metadata: { path: ['streakCycle'], equals: streakBonusKey } },
        });
        if (!existingBonus) {
          await this.awardPoints(userId, streakRule.bonusAmount, streakRule.pointType, `Bonus ${streakRule.streakDays} hari berturut login`, { streakCycle: streakBonusKey, streakDays });
        }
      }
    }

    return { awarded: true, amount: loginRule.amount };
  }

  private async calculateLoginStreak(userId: string, pointType: string): Promise<number> {
    // Get login points ordered by date desc
    const loginPoints = await this.prisma.point.findMany({
      where: { userId, type: pointType, reason: 'Daily login bonus' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (loginPoints.length === 0) return 0;

    // Count consecutive days
    let streak = 0;
    let expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);

    for (const point of loginPoints) {
      const pointDate = new Date(point.createdAt);
      pointDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((expectedDate.getTime() - pointDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (diffDays === 1) {
        // Gap of 1 day is OK (today not counted yet, yesterday was)
        streak++;
        expectedDate = pointDate;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    return streak;
  }

  async awardRegistrationPoints(userId: string) {
    return this.awardPoints(userId, 50, 'registration', 'Welcome bonus');
  }

  async awardOrderCompletePoints(userId: string, orderId: string) {
    return this.awardPoints(userId, 20, 'order_complete', 'Order completed', { orderId });
  }

  async awardReferralPoints(userId: string, referredUserId: string) {
    return this.awardPoints(userId, 30, 'referral', 'Referral bonus', { referredUserId });
  }

  async awardTreeCreatedPoints(userId: string, treeId: string) {
    return this.awardPoints(userId, 10, 'tree_created', 'Family tree created', { treeId });
  }

  async awardReviewPoints(userId: string, reviewId: string) {
    return this.awardPoints(userId, 10, 'review', 'Review submitted', { reviewId });
  }

  async awardNetworkAddPoints(userId: string, newUserId: string) {
    const rule = await this.prisma.gamiRule.findUnique({ where: { key: 'network_add' } });
    if (!rule || !rule.isEnabled || rule.amount <= 0) return null;
    return this.awardPoints(userId, rule.amount, rule.pointType, 'Penambahan jaringan keluarga', { newUserId });
  }
}
