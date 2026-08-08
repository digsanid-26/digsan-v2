import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateSubCategoryDto,
  UpdateSubCategoryDto,
  CreateServiceDto,
  UpdateServiceDto,
} from './dto/job-admin.dto';

@Injectable()
export class JobAdminService {
  constructor(private prisma: PrismaService) {}

  // ─── CATEGORY CRUD ─────────────────────────────────────────

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.jobCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug kategori sudah digunakan');

    return this.prisma.jobCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        image: dto.image,
        order: dto.order ?? 0,
      },
      include: { _count: { select: { subCategories: true } } },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.jobCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.jobCategory.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug sudah digunakan');
    }

    return this.prisma.jobCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { _count: { select: { subCategories: true } } },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.jobCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');

    const subCount = await this.prisma.jobSubCategory.count({ where: { categoryId: id } });
    if (subCount > 0) {
      throw new BadRequestException(`Tidak bisa menghapus kategori yang masih memiliki ${subCount} sub-kategori. Hapus sub-kategori terlebih dahulu.`);
    }

    await this.prisma.jobCategory.delete({ where: { id } });
    return { message: `Kategori '${category.name}' berhasil dihapus` };
  }

  // ─── SUB-CATEGORY CRUD ─────────────────────────────────────

  async createSubCategory(dto: CreateSubCategoryDto) {
    const category = await this.prisma.jobCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Kategori tidak ditemukan');

    const existing = await this.prisma.jobSubCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug sub-kategori sudah digunakan');

    return this.prisma.jobSubCategory.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        image: dto.image,
        order: dto.order ?? 0,
      },
      include: { category: { select: { id: true, name: true } }, _count: { select: { services: true } } },
    });
  }

  async updateSubCategory(id: string, dto: UpdateSubCategoryDto) {
    const sub = await this.prisma.jobSubCategory.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Sub-kategori tidak ditemukan');

    if (dto.slug && dto.slug !== sub.slug) {
      const existing = await this.prisma.jobSubCategory.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug sudah digunakan');
    }

    return this.prisma.jobSubCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: { select: { id: true, name: true } }, _count: { select: { services: true } } },
    });
  }

  async deleteSubCategory(id: string) {
    const sub = await this.prisma.jobSubCategory.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Sub-kategori tidak ditemukan');

    const svcCount = await this.prisma.jobService.count({ where: { subCategoryId: id } });
    if (svcCount > 0) {
      throw new BadRequestException(`Tidak bisa menghapus sub-kategori yang masih memiliki ${svcCount} layanan. Hapus layanan terlebih dahulu.`);
    }

    await this.prisma.jobSubCategory.delete({ where: { id } });
    return { message: `Sub-kategori '${sub.name}' berhasil dihapus` };
  }

  // ─── SERVICE CRUD ──────────────────────────────────────────

  async createService(dto: CreateServiceDto) {
    const sub = await this.prisma.jobSubCategory.findUnique({ where: { id: dto.subCategoryId } });
    if (!sub) throw new NotFoundException('Sub-kategori tidak ditemukan');

    const existing = await this.prisma.jobService.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug layanan sudah digunakan');

    return this.prisma.jobService.create({
      data: {
        subCategoryId: dto.subCategoryId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        image: dto.image,
        basePrice: dto.basePrice,
        priceUnit: dto.priceUnit,
        duration: dto.duration,
        order: dto.order ?? 0,
        isFeatured: dto.isFeatured ?? false,
      },
      include: { subCategory: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } },
    });
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const svc = await this.prisma.jobService.findUnique({ where: { id } });
    if (!svc) throw new NotFoundException('Layanan tidak ditemukan');

    if (dto.slug && dto.slug !== svc.slug) {
      const existing = await this.prisma.jobService.findUnique({ where: { slug: dto.slug } });
      if (existing) throw new ConflictException('Slug sudah digunakan');
    }

    return this.prisma.jobService.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.priceUnit !== undefined && { priceUnit: dto.priceUnit }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      },
      include: { subCategory: { select: { id: true, name: true, category: { select: { id: true, name: true } } } } },
    });
  }

  async deleteService(id: string) {
    const svc = await this.prisma.jobService.findUnique({ where: { id } });
    if (!svc) throw new NotFoundException('Layanan tidak ditemukan');

    const orderCount = await this.prisma.jobOrder.count({ where: { serviceId: id } });
    if (orderCount > 0) {
      throw new BadRequestException(`Tidak bisa menghapus layanan yang sudah memiliki ${orderCount} order. Nonaktifkan saja (set isActive=false).`);
    }

    await this.prisma.jobService.delete({ where: { id } });
    return { message: `Layanan '${svc.name}' berhasil dihapus` };
  }

  // ─── ADMIN ORDER ACTIONS ───────────────────────────────────

  async assignProvider(orderId: string, providerId: string) {
    const order = await this.prisma.jobOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.providerId) throw new BadRequestException('Order sudah memiliki pekerja');

    const worker = await this.prisma.jobWorkerProfile.findFirst({
      where: { userId: providerId, providerStatus: 'APPROVED' },
    });
    if (!worker) throw new BadRequestException('Pekerja tidak ditemukan atau belum disetujui');

    return this.prisma.jobOrder.update({
      where: { id: orderId },
      data: { providerId, status: 'WAITING_WORKER' },
      include: {
        provider: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async updateOrderStatus(orderId: string, status: string, notes?: string) {
    const order = await this.prisma.jobOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');

    const validStatuses = ['PENDING', 'WAITING_WORKER', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) throw new BadRequestException('Status tidak valid');

    const now = new Date();
    const data: any = { status };
    if (status === 'CONFIRMED') data.confirmedAt = now;
    if (status === 'IN_PROGRESS') data.startedAt = now;
    if (status === 'COMPLETED') data.completedAt = now;
    if (status === 'CANCELLED') data.cancelledAt = now;
    if (notes) data.providerNotes = notes;

    return this.prisma.jobOrder.update({
      where: { id: orderId },
      data,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        provider: { select: { id: true, name: true, email: true } },
        service: { select: { name: true } },
        payment: { select: { status: true, method: true } },
      },
    });
  }

  // ─── ADMIN PAYMENT LIST ────────────────────────────────────

  async getPayments(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { order: { orderNumber: { contains: query.search, mode: 'insensitive' } } },
        { transactionId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.jobPayment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              serviceName: true,
              customer: { select: { id: true, name: true } },
              provider: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobPayment.count({ where }),
    ]);

    return { payments, total, page, limit };
  }
}
