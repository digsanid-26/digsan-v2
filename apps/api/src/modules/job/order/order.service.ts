import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto, OrderStatusAction } from './dto/update-order-status.dto';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE ORDER ───────────────────────────────────────────

  async create(userId: string, dto: CreateOrderDto) {
    // Validate service exists
    const service = await this.prisma.jobService.findUnique({
      where: { id: dto.serviceId },
      include: { subCategory: true },
    });
    if (!service) throw new NotFoundException('Layanan tidak ditemukan');

    // Validate address belongs to user
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) throw new NotFoundException('Alamat tidak ditemukan');

    // Validate provider if specified
    if (dto.providerId) {
      const provider = await this.prisma.jobWorkerProfile.findFirst({
        where: { userId: dto.providerId, providerStatus: 'APPROVED' },
      });
      if (!provider) throw new BadRequestException('Pekerja tidak ditemukan atau belum disetujui');
    }

    // Calculate pricing
    const pricingType = (dto.pricingType as any) ?? 'PER_JAM';
    const basePrice = Number(service.basePrice);
    const duration = dto.duration;
    const calculatedPrice = pricingType === 'PER_JAM' ? basePrice * duration : basePrice;
    const serviceFee = Math.round(calculatedPrice * 0.1); // 10% service fee
    const totalPrice = calculatedPrice + serviceFee;

    // Generate order number: ORD-YYYYMMDD-XXXXX
    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.jobOrder.create({
      data: {
        orderNumber,
        customerId: userId,
        providerId: dto.providerId || null,
        serviceId: dto.serviceId,
        subCategoryId: dto.subCategoryId || service.subCategoryId,
        addressId: dto.addressId,
        serviceName: service.name,
        categoryName: service.subCategory?.name,
        description: dto.description,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledTime: dto.scheduledTime,
        duration,
        pricingType,
        basePrice: calculatedPrice,
        serviceFee,
        totalPrice,
        status: dto.providerId ? 'WAITING_WORKER' : 'PENDING',
        customerNotes: dto.customerNotes,
      },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true } },
        address: true,
        customer: { select: { id: true, name: true, email: true } },
        provider: { select: { id: true, name: true, email: true } },
      },
    });

    return order;
  }

  // ─── LIST ORDERS ────────────────────────────────────────────

  async findAll(userId: string, query: {
    role?: 'customer' | 'provider';
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const role = query.role ?? 'customer';

    const where: any = {};
    if (role === 'customer') {
      where.customerId = userId;
    } else {
      where.providerId = userId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.jobOrder.findMany({
        where,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          address: { select: { label: true, fullAddress: true } },
          customer: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
          payment: { select: { status: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobOrder.count({ where }),
    ]);

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── ORDER DETAIL ───────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const order = await this.prisma.jobOrder.findUnique({
      where: { id },
      include: {
        service: { select: { id: true, name: true, slug: true, basePrice: true, priceUnit: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        address: true,
        customer: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
        provider: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
        payment: true,
        review: true,
        images: true,
      },
    });

    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.customerId !== userId && order.providerId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    return order;
  }

  // ─── ORDER BY NUMBER ────────────────────────────────────────

  async findByOrderNumber(orderNumber: string, userId: string) {
    const order = await this.prisma.jobOrder.findUnique({
      where: { orderNumber },
      include: {
        service: { select: { id: true, name: true } },
        address: { select: { label: true, fullAddress: true } },
        customer: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
        payment: true,
      },
    });

    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.customerId !== userId && order.providerId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    return order;
  }

  // ─── STATUS FLOW ────────────────────────────────────────────

  async updateStatus(id: string, userId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.jobOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');

    // Validate user is either customer or provider
    const isCustomer = order.customerId === userId;
    const isProvider = order.providerId === userId;
    if (!isCustomer && !isProvider) {
      throw new ForbiddenException('Anda tidak memiliki akses ke order ini');
    }

    const now = new Date();

    switch (dto.action) {
      case OrderStatusAction.CONFIRM:
        // Only provider can confirm
        if (!isProvider) throw new ForbiddenException('Hanya pekerja yang bisa mengkonfirmasi order');
        if (order.status !== 'WAITING_WORKER') throw new BadRequestException('Order tidak dalam status menunggu pekerja');
        return this.prisma.jobOrder.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: now,
            providerNotes: dto.notes,
          },
        });

      case OrderStatusAction.REJECT:
        // Only provider can reject
        if (!isProvider) throw new ForbiddenException('Hanya pekerja yang bisa menolak order');
        if (order.status !== 'WAITING_WORKER') throw new BadRequestException('Order tidak dalam status menunggu pekerja');
        return this.prisma.jobOrder.update({
          where: { id },
          data: {
            status: 'PENDING',
            providerId: null,
            workerResponseAt: now,
            workerRejectionReason: dto.reason,
          },
        });

      case OrderStatusAction.START:
        // Only provider can start
        if (!isProvider) throw new ForbiddenException('Hanya pekerja yang bisa memulai pekerjaan');
        if (order.status !== 'CONFIRMED') throw new BadRequestException('Order belum dikonfirmasi');
        return this.prisma.jobOrder.update({
          where: { id },
          data: {
            status: 'IN_PROGRESS',
            startedAt: now,
            actualStartTime: dto.actualStartTime || order.scheduledTime,
          },
        });

      case OrderStatusAction.COMPLETE:
        // Only provider can complete
        if (!isProvider) throw new ForbiddenException('Hanya pekerja yang bisa menyelesaikan order');
        if (order.status !== 'IN_PROGRESS') throw new BadRequestException('Order belum dimulai');

        const actualDuration = dto.actualEndTime && order.actualStartTime
          ? this.calculateDurationMinutes(order.actualStartTime, dto.actualEndTime)
          : order.duration * 60;
        const scheduledDurationMinutes = order.duration * 60;
        const isEarly = actualDuration < scheduledDurationMinutes;

        return this.prisma.jobOrder.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            actualEndTime: dto.actualEndTime,
            actualDuration,
            isEarlyCompletion: isEarly,
            earlyCompletionMinutes: isEarly ? scheduledDurationMinutes - actualDuration : null,
            providerNotes: dto.notes || order.providerNotes,
          },
        });

      case OrderStatusAction.CANCEL:
        // Both customer and provider can cancel (with restrictions)
        const cancellableStatuses = ['PENDING', 'WAITING_WORKER', 'CONFIRMED'];
        if (!cancellableStatuses.includes(order.status)) {
          throw new BadRequestException('Order tidak dapat dibatalkan pada status ini');
        }
        return this.prisma.jobOrder.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            ...(isCustomer ? { customerNotes: dto.reason } : { providerNotes: dto.reason }),
          },
        });

      default:
        throw new BadRequestException('Aksi tidak valid');
    }
  }

  // ─── ASSIGN PROVIDER ────────────────────────────────────────

  async assignProvider(orderId: string, providerId: string) {
    const order = await this.prisma.jobOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.status !== 'PENDING') throw new BadRequestException('Order sudah memiliki pekerja atau tidak dalam status pending');

    const worker = await this.prisma.jobWorkerProfile.findFirst({
      where: { userId: providerId, providerStatus: 'APPROVED' },
    });
    if (!worker) throw new BadRequestException('Pekerja tidak ditemukan atau belum disetujui');

    return this.prisma.jobOrder.update({
      where: { id: orderId },
      data: {
        providerId,
        status: 'WAITING_WORKER',
      },
      include: {
        provider: { select: { id: true, name: true } },
      },
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Count today's orders
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const count = await this.prisma.jobOrder.count({
      where: {
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
    });

    const sequence = String(count + 1).padStart(5, '0');
    return `ORD-${dateStr}-${sequence}`;
  }

  private calculateDurationMinutes(startTime: string, endTime: string): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }
}
