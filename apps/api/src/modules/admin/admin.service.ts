import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── DASHBOARD ────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      totalTrees,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalWorkers,
      pendingWorkers,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.familyTree.count(),
      this.prisma.jobOrder.count().catch(() => 0),
      this.prisma.jobOrder.count({ where: { status: 'PENDING' } }).catch(() => 0),
      this.prisma.jobOrder.count({ where: { status: 'COMPLETED' } }).catch(() => 0),
      this.prisma.jobWorkerProfile.count().catch(() => 0),
      this.prisma.jobWorkerProfile.count({ where: { providerStatus: 'PENDING' } }).catch(() => 0),
      this.prisma.jobPayment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }).catch(() => ({ _sum: { amount: null } })),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, pending: pendingUsers },
      trees: { total: totalTrees },
      orders: { total: totalOrders, pending: pendingOrders, completed: completedOrders },
      workers: { total: totalWorkers, pending: pendingWorkers },
      revenue: { total: totalRevenue._sum?.amount || 0 },
    };
  }

  // ─── FAMILY TREE MANAGEMENT ─────────────────────────────────

  async getTrees(query: { page?: number; limit?: number; search?: string; hasSlug?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.hasSlug === 'yes') where.slug = { not: null };
    if (query.hasSlug === 'no') where.slug = null;

    const [trees, total] = await this.prisma.$transaction([
      this.prisma.familyTree.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, name: true, email: true, username: true, avatar: true, status: true },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.familyTree.count({ where }),
    ]);

    return {
      trees: trees.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        owner: t.user,
        memberCount: t._count?.members ?? 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── USER MANAGEMENT ──────────────────────────────────────

  async getUsers(query: { page?: number; limit?: number; search?: string; status?: string; role?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.role) {
      where.userRoles = { some: { role: { name: query.role } } };
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatar: true,
          status: true,
          provider: true,
          emailVerified: true,
          createdAt: true,
          userRoles: { include: { role: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u: any) => ({
        ...u,
        roles: u.userRoles.map((ur: any) => ur.role.name),
        userRoles: undefined,
      })),
      total,
      page,
      limit,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        jobWorkerProfile: { include: { skills: true } },
        _count: {
          select: {
            customerOrders: true,
            providerOrders: true,
            notifications: true,
            familyTrees: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User tidak ditemukan');

    const { passwordHash, ...safeUser } = user;
    return {
      ...safeUser,
      roles: user.userRoles.map((ur: any) => ur.role.name),
    };
  }

  async updateUserStatus(userId: string, status: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    return this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  async assignRole(userId: string, roleName: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException(`Role '${roleName}' tidak ditemukan`);

    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id },
    });
    if (existing) throw new BadRequestException(`User sudah memiliki role '${roleName}'`);

    await this.prisma.userRole.create({
      data: { userId, roleId: role.id },
    });

    return { message: `Role '${roleName}' berhasil ditambahkan` };
  }

  async removeRole(userId: string, roleName: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException(`Role '${roleName}' tidak ditemukan`);

    const userRole = await this.prisma.userRole.findFirst({
      where: { userId, roleId: role.id },
    });
    if (!userRole) throw new BadRequestException(`User tidak memiliki role '${roleName}'`);

    await this.prisma.userRole.delete({ where: { id: userRole.id } });
    return { message: `Role '${roleName}' berhasil dihapus` };
  }

  // ─── WORKER MANAGEMENT ────────────────────────────────────

  async getWorkers(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.providerStatus = query.status;
    if (query.search) {
      where.user = { name: { contains: query.search, mode: 'insensitive' } };
    }

    const [workers, total] = await this.prisma.$transaction([
      this.prisma.jobWorkerProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
          skills: { include: { subCategory: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobWorkerProfile.count({ where }),
    ]);

    return { workers, total, page, limit };
  }

  async updateWorkerStatus(workerId: string, providerStatus: string, reason?: string) {
    const worker = await this.prisma.jobWorkerProfile.findUnique({
      where: { id: workerId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!worker) throw new NotFoundException('Worker tidak ditemukan');

    return this.prisma.jobWorkerProfile.update({
      where: { id: workerId },
      data: { providerStatus: providerStatus as any },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ─── ORDER MANAGEMENT ─────────────────────────────────────

  async getOrders(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.orderNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.jobOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          provider: { select: { id: true, name: true, email: true } },
          service: { select: { name: true } },
          payment: { select: { status: true, amount: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobOrder.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  async getOrderDetail(orderId: string) {
    const order = await this.prisma.jobOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        provider: { select: { id: true, name: true, email: true, phone: true } },
        service: true,
        subCategory: { select: { name: true, category: { select: { name: true } } } },
        payment: true,
        review: true,
        images: true,
        address: true,
      },
    });

    if (!order) throw new NotFoundException('Order tidak ditemukan');
    return order;
  }

  // ─── SYSTEM SETTINGS ──────────────────────────────────────

  async getSettings(category?: string) {
    const where = category ? { category } : {};
    return this.prisma.systemSettings.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async updateSetting(key: string, value: string) {
    const setting = await this.prisma.systemSettings.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' tidak ditemukan`);

    return this.prisma.systemSettings.update({
      where: { key },
      data: { value },
    });
  }

  // ─── APP CONFIG ───────────────────────────────────────────

  async getAppConfigs(category?: string) {
    const where = category ? { category } : {};
    return this.prisma.appConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async createAppConfig(data: { key: string; value: string; type?: string; category?: string; description?: string }) {
    const existing = await this.prisma.appConfig.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException(`Config '${data.key}' sudah ada`);

    return this.prisma.appConfig.create({ data });
  }

  async updateAppConfig(key: string, data: { value: string; description?: string }) {
    const config = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`Config '${key}' tidak ditemukan`);

    return this.prisma.appConfig.update({ where: { key }, data });
  }

  async deleteAppConfig(key: string) {
    const config = await this.prisma.appConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`Config '${key}' tidak ditemukan`);

    await this.prisma.appConfig.delete({ where: { key } });
    return { message: `Config '${key}' dihapus` };
  }
}
