import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/database/prisma.service';
import { CreatePaymentDto, PaymentWebhookDto, UploadPaymentProofDto } from './dto/create-payment.dto';
import { IpaymuService } from './ipaymu.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly paymentGateway: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private ipaymuService: IpaymuService,
  ) {
    this.paymentGateway = this.configService.get<string>('PAYMENT_GATEWAY') || 'ipaymu';
  }

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

    // Get customer details
    const customer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });

    let paymentData: any = {
      orderId: dto.orderId,
      amount: order.totalPrice,
      method: dto.method as any,
      status: 'PENDING',
    };

    // Integrate with payment gateway
    if (this.paymentGateway === 'ipaymu') {
      try {
        const callbackUrl = this.configService.get<string>('IPAYMU_CALLBACK_URL') || '';
        const ipaymuResponse = await this.ipaymuService.createDirectPayment({
          orderNumber: order.orderNumber,
          customerName: customer?.name || 'Customer',
          customerEmail: customer?.email || 'customer@example.com',
          customerPhone: customer?.phone || '08123456789',
          amount: order.totalPrice,
          productName: `Order ${order.orderNumber}`,
          notifyUrl: callbackUrl,
        });

        paymentData = {
          ...paymentData,
          transactionId: ipaymuResponse.Data.TransactionId,
          snapToken: ipaymuResponse.Data.SessionID,
          snapUrl: ipaymuResponse.Data.PaymentNo,
          metadata: ipaymuResponse.Data as any,
        };

        this.logger.log(`iPaymu payment created: ${ipaymuResponse.Data.TransactionId}`);
      } catch (error) {
        this.logger.error('Failed to create iPaymu payment:', error);
        throw new BadRequestException('Gagal membuat pembayaran. Silakan coba lagi.');
      }
    }

    // Create payment record
    const payment = await this.prisma.jobPayment.create({
      data: paymentData,
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

  // ─── WEBHOOK (iPaymu / Midtrans) ────────────────────────────

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
      this.logger.warn(`Payment not found for transaction: ${dto.transactionId}`);
      return { message: 'Payment not found, ignoring webhook' };
    }

    const status = dto.transactionStatus;
    const now = new Date();

    // Map status based on payment gateway
    let internalStatus: 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'PENDING' = 'PENDING';

    if (this.paymentGateway === 'ipaymu') {
      internalStatus = this.ipaymuService.mapStatus(status);
    } else {
      // Midtrans mapping
      if (status === 'capture' || status === 'settlement') internalStatus = 'PAID';
      else if (status === 'deny' || status === 'cancel' || status === 'failure') internalStatus = 'FAILED';
      else if (status === 'expire') internalStatus = 'EXPIRED';
      else if (status === 'refund' || status === 'partial_refund') internalStatus = 'REFUNDED';
    }

    // Update payment based on status
    if (internalStatus === 'PAID') {
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
      this.logger.log(`Payment ${payment.id} marked as PAID`);
      return { message: 'Payment marked as PAID' };
    }

    if (internalStatus === 'FAILED') {
      await this.prisma.jobPayment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: dto as any,
        },
      });
      this.logger.log(`Payment ${payment.id} marked as FAILED`);
      return { message: 'Payment marked as FAILED' };
    }

    if (internalStatus === 'EXPIRED') {
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
      this.logger.log(`Payment ${payment.id} marked as EXPIRED`);
      return { message: 'Payment marked as EXPIRED' };
    }

    if (internalStatus === 'REFUNDED') {
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
      this.logger.log(`Payment ${payment.id} marked as REFUNDED`);
      return { message: 'Payment marked as REFUNDED' };
    }

    this.logger.warn(`Unhandled payment status: ${status}`);
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
