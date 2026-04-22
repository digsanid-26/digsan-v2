import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';
import { CreatePaymentDto, PaymentWebhookDto, UploadPaymentProofDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  // ─── CREATE PAYMENT ─────────────────────────────────────────

  async createPayment(userId: string, dto: CreatePaymentDto) {
    const order = await this.prisma.jobOrder.findUnique({
      where: { id: dto.orderId },
      include: { payment: true },
    });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.customerId !== userId) throw new ForbiddenException('Hanya pelanggan yang bisa membuat pembayaran');
    if (order.payment) throw new BadRequestException('Pembayaran untuk order ini sudah ada');

    const cancellableStatuses = ['CANCELLED', 'REFUNDED'];
    if (cancellableStatuses.includes(order.status)) {
      throw new BadRequestException('Order sudah dibatalkan');
    }

    // Create payment record
    const payment = await this.prisma.jobPayment.create({
      data: {
        orderId: dto.orderId,
        amount: order.totalPrice,
        method: dto.method as any,
        status: 'PENDING',
        // In production, integrate with Midtrans here:
        // const snap = await midtrans.createTransaction(...)
        // transactionId: snap.transaction_id,
        // snapToken: snap.token,
        // snapUrl: snap.redirect_url,
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, totalPrice: true, status: true },
        },
      },
    });

    return payment;
  }

  // ─── GET PAYMENT ────────────────────────────────────────────

  async getPayment(orderId: string, userId: string) {
    const order = await this.prisma.jobOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order tidak ditemukan');
    if (order.customerId !== userId && order.providerId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses');
    }

    const payment = await this.prisma.jobPayment.findUnique({
      where: { orderId },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, totalPrice: true },
        },
      },
    });
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');

    return payment;
  }

  // ─── UPLOAD PAYMENT PROOF ───────────────────────────────────

  async uploadProof(paymentId: string, userId: string, dto: UploadPaymentProofDto) {
    const payment = await this.prisma.jobPayment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');
    if (payment.order.customerId !== userId) throw new ForbiddenException('Hanya pelanggan yang bisa upload bukti');
    if (payment.status !== 'PENDING') throw new BadRequestException('Pembayaran tidak dalam status pending');

    return this.prisma.jobPayment.update({
      where: { id: paymentId },
      data: {
        proofImage: dto.proofImage,
        proofUploadedAt: new Date(),
        status: 'CONFIRMING',
      },
    });
  }

  // ─── WEBHOOK (Midtrans) ─────────────────────────────────────

  async handleWebhook(dto: PaymentWebhookDto) {
    // Find payment by transaction ID
    const payment = await this.prisma.jobPayment.findFirst({
      where: {
        OR: [
          { transactionId: dto.transactionId },
          ...(dto.orderId ? [{ order: { orderNumber: dto.orderId } }] : []),
        ],
      },
      include: { order: true },
    });

    if (!payment) {
      // Log but don't throw — webhook may retry
      return { message: 'Payment not found, ignoring webhook' };
    }

    const status = dto.transactionStatus;
    const now = new Date();

    if (status === 'capture' || status === 'settlement') {
      // Payment success
      await this.prisma.$transaction([
        this.prisma.jobPayment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            paidAt: now,
            metadata: dto as any,
          },
        }),
        this.prisma.jobOrder.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: 'PAID',
            paidAt: now,
          },
        }),
      ]);
      return { message: 'Payment marked as PAID' };
    }

    if (status === 'deny' || status === 'cancel' || status === 'failure') {
      await this.prisma.jobPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: dto as any,
        },
      });
      return { message: 'Payment marked as FAILED' };
    }

    if (status === 'expire') {
      await this.prisma.$transaction([
        this.prisma.jobPayment.update({
          where: { id: payment.id },
          data: { status: 'EXPIRED', metadata: dto as any },
        }),
        this.prisma.jobOrder.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'EXPIRED' },
        }),
      ]);
      return { message: 'Payment marked as EXPIRED' };
    }

    if (status === 'refund' || status === 'partial_refund') {
      await this.prisma.$transaction([
        this.prisma.jobPayment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', metadata: dto as any },
        }),
        this.prisma.jobOrder.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
        }),
      ]);
      return { message: 'Payment marked as REFUNDED' };
    }

    return { message: `Unhandled status: ${status}` };
  }

  // ─── ADMIN: CONFIRM MANUAL PAYMENT ──────────────────────────

  async confirmPayment(paymentId: string) {
    const payment = await this.prisma.jobPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');
    if (payment.status !== 'CONFIRMING' && payment.status !== 'PENDING') {
      throw new BadRequestException('Pembayaran tidak dalam status yang bisa dikonfirmasi');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.jobPayment.update({
        where: { id: paymentId },
        data: { status: 'PAID', paidAt: now },
      }),
      this.prisma.jobOrder.update({
        where: { id: payment.orderId },
        data: { paymentStatus: 'PAID', paidAt: now },
      }),
    ]);

    return { message: 'Pembayaran dikonfirmasi' };
  }
}
