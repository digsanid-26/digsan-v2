import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.jobCategory.findMany({
      where: { isActive: true },
      include: {
        subCategories: {
          where: { isActive: true },
          include: {
            services: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.jobCategory.findUnique({
      where: { slug },
      include: {
        subCategories: {
          where: { isActive: true },
          include: {
            services: { where: { isActive: true } },
          },
        },
      },
    });

    if (!category) throw new NotFoundException('Kategori tidak ditemukan');
    return category;
  }

  async getServices(query: any) {
    const { categoryId, search, page = 1, limit = 20 } = query;

    const where: any = { isActive: true };
    if (categoryId) where.subCategory = { categoryId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [services, total] = await Promise.all([
      this.prisma.jobService.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { order: 'asc' },
      }),
      this.prisma.jobService.count({ where }),
    ]);

    return { services, total, page: Number(page), limit: Number(limit) };
  }

  async getServiceBySlug(slug: string) {
    const service = await this.prisma.jobService.findUnique({
      where: { slug },
      include: {
        subCategory: {
          include: { category: true },
        },
      },
    });

    if (!service) throw new NotFoundException('Layanan tidak ditemukan');
    return service;
  }
}
