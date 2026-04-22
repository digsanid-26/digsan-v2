import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE REVIEW ──────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto) {
    const order = await this.prisma.jobOrder.findUnique({
      where: { id: dto.orderId },
      include: { review: true },
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.customerId !== userId) throw new ForbiddenException('Hanya pelanggan yang bisa memberikan review');
    if (order.status !== 'COMPLETED') throw new BadRequestException('Order belum selesai');
    if (order.review) throw new ConflictException('Review untuk order ini sudah ada');

    const review = await this.prisma.jobReview.create({
      data: {
        orderId: dto.orderId,
        userId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        order: { select: { id: true, orderNumber: true, serviceName: true, providerId: true } },
      },
    });

    // Update provider's aggregate rating
    if (order.providerId) {
      await this.updateProviderRating(order.providerId);
    }

    return review;
  }

  // ─── GET REVIEWS FOR PROVIDER ───────────────────────────────

  async getProviderReviews(providerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.jobReview.findMany({
        where: { order: { providerId } },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          order: { select: { id: true, orderNumber: true, serviceName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobReview.count({ where: { order: { providerId } } }),
    ]);

    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── GET REVIEW FOR ORDER ───────────────────────────────────

  async getOrderReview(orderId: string) {
    const review = await this.prisma.jobReview.findUnique({
      where: { orderId },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!review) throw new NotFoundException('Review tidak ditemukan');
    return review;
  }

  // ─── HELPERS ────────────────────────────────────────────────

  private async updateProviderRating(providerId: string) {
    const stats = await this.prisma.jobReview.aggregate({
      where: { order: { providerId } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const profile = await this.prisma.jobWorkerProfile.findFirst({
      where: { userId: providerId },
    });
    if (!profile) return;

    await this.prisma.jobWorkerProfile.update({
      where: { id: profile.id },
      data: {
        rating: stats._avg.rating ?? 0,
        totalReviews: stats._count.rating,
      },
    });
  }
}
