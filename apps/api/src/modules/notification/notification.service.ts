import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from './email.service';
import { WhatsappService } from './whatsapp.service';
import { PushService } from './push.service';

enum NotificationType {
  TREE_INVITATION = 'TREE_INVITATION',
  MEMBER_ADDED = 'MEMBER_ADDED',
  BADGE_EARNED = 'BADGE_EARNED',
  POINT_RECEIVED = 'POINT_RECEIVED',
  SYSTEM = 'SYSTEM',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private whatsappService: WhatsappService,
    private pushService: PushService,
  ) {}

  // ─── QUERY ────────────────────────────────────────────────

  async findAll(userId: string, query?: { page?: number; limit?: number; isRead?: string; type?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query?.isRead === 'true') where.isRead = true;
    if (query?.isRead === 'false') where.isRead = false;
    if (query?.type) where.type = query.type;

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total, page, limit };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  // ─── MUTATIONS ────────────────────────────────────────────

  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { message: `${result.count} notifikasi ditandai sudah dibaca` };
  }

  async remove(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notifikasi tidak ditemukan');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notifikasi dihapus' };
  }

  // ─── CREATE (internal) ────────────────────────────────────

  async create(data: { userId: string; type: NotificationType; title: string; message: string; data?: any }) {
    return this.prisma.notification.create({ data });
  }

  // ─── ORDER NOTIFICATIONS ──────────────────────────────────

  async notifyOrderCreated(orderId: string, customerId: string, providerId: string | null, orderNumber: string) {
    // Notify customer
    await this.create({
      userId: customerId,
      type: NotificationType.ORDER_CREATED,
      title: 'Pesanan Dibuat',
      message: `Pesanan #${orderNumber} berhasil dibuat.`,
      data: { orderId, orderNumber },
    });

    // Notify provider if assigned
    if (providerId) {
      await this.create({
        userId: providerId,
        type: NotificationType.ORDER_CREATED,
        title: 'Pesanan Baru',
        message: `Anda mendapat pesanan baru #${orderNumber}.`,
        data: { orderId, orderNumber },
      });
      this.sendPushSafe(providerId, 'Pesanan Baru', `Anda mendapat pesanan baru #${orderNumber}`);
    }
  }

  async notifyOrderConfirmed(orderId: string, customerId: string, orderNumber: string) {
    await this.create({
      userId: customerId,
      type: NotificationType.ORDER_CONFIRMED,
      title: 'Pesanan Dikonfirmasi',
      message: `Pesanan #${orderNumber} telah dikonfirmasi pekerja.`,
      data: { orderId, orderNumber },
    });
    this.sendPushSafe(customerId, 'Pesanan Dikonfirmasi', `Pesanan #${orderNumber} telah dikonfirmasi`);
  }

  async notifyOrderCompleted(orderId: string, customerId: string, providerId: string, orderNumber: string) {
    await this.create({
      userId: customerId,
      type: NotificationType.ORDER_COMPLETED,
      title: 'Pesanan Selesai',
      message: `Pesanan #${orderNumber} telah selesai. Yuk beri ulasan!`,
      data: { orderId, orderNumber },
    });
    await this.create({
      userId: providerId,
      type: NotificationType.ORDER_COMPLETED,
      title: 'Pekerjaan Selesai',
      message: `Pekerjaan #${orderNumber} telah diselesaikan.`,
      data: { orderId, orderNumber },
    });
    this.sendPushSafe(customerId, 'Pesanan Selesai', `Pesanan #${orderNumber} selesai. Beri ulasan!`);
  }

  async notifyOrderCancelled(orderId: string, customerId: string, providerId: string | null, orderNumber: string, reason?: string) {
    const msg = reason ? `Pesanan #${orderNumber} dibatalkan: ${reason}` : `Pesanan #${orderNumber} dibatalkan.`;
    await this.create({
      userId: customerId,
      type: NotificationType.ORDER_CANCELLED,
      title: 'Pesanan Dibatalkan',
      message: msg,
      data: { orderId, orderNumber, reason },
    });
    if (providerId) {
      await this.create({
        userId: providerId,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Pesanan Dibatalkan',
        message: msg,
        data: { orderId, orderNumber, reason },
      });
      this.sendPushSafe(providerId, 'Pesanan Dibatalkan', msg);
    }
  }

  // ─── PAYMENT NOTIFICATIONS ────────────────────────────────

  async notifyPaymentSuccess(orderId: string, customerId: string, orderNumber: string, amount: number) {
    await this.create({
      userId: customerId,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Pembayaran Berhasil',
      message: `Pembayaran Rp ${amount.toLocaleString('id-ID')} untuk pesanan #${orderNumber} berhasil.`,
      data: { orderId, orderNumber, amount },
    });
    this.sendPushSafe(customerId, 'Pembayaran Berhasil', `Pembayaran untuk #${orderNumber} berhasil`);
  }

  async notifyPaymentFailed(orderId: string, customerId: string, orderNumber: string) {
    await this.create({
      userId: customerId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Pembayaran Gagal',
      message: `Pembayaran untuk pesanan #${orderNumber} gagal. Silakan coba lagi.`,
      data: { orderId, orderNumber },
    });
  }

  // ─── REVIEW NOTIFICATIONS ────────────────────────────────

  async notifyReviewReceived(providerId: string, rating: number, orderNumber: string) {
    await this.create({
      userId: providerId,
      type: NotificationType.REVIEW_RECEIVED,
      title: 'Ulasan Baru',
      message: `Anda mendapat ulasan bintang ${rating} untuk pesanan #${orderNumber}.`,
      data: { rating, orderNumber },
    });
    this.sendPushSafe(providerId, 'Ulasan Baru', `Bintang ${rating} untuk #${orderNumber}`);
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private sendPushSafe(userId: string, title: string, body: string) {
    this.pushService.sendToUser(userId, title, body).catch((err) => {
      this.logger.warn(`Push failed for ${userId}: ${err.message}`);
    });
  }

  async sendWhatsappOrderUpdate(phone: string, name: string, orderNumber: string, status: string) {
    this.whatsappService
      .sendOrderNotification(phone, name, orderNumber, status)
      .catch((err) => this.logger.warn(`WA order notify failed: ${err.message}`));
  }

  async sendEmailOrderConfirmation(email: string, name: string, orderNumber: string, serviceName: string, totalPrice: number) {
    const html = this.emailService['wrapTemplate'](`
      <h2 style="color:#1e293b;margin:0 0 16px">Pesanan Dikonfirmasi! ✅</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Pesanan <strong>#${orderNumber}</strong> telah dikonfirmasi.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">Layanan</td><td style="padding:8px 0;font-weight:600">${serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:600">Rp ${totalPrice.toLocaleString('id-ID')}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:14px">Buka aplikasi Digsan untuk detail lengkap.</p>
    `);
    this.emailService.sendEmail(email, `Pesanan #${orderNumber} Dikonfirmasi`, html)
      .catch((err) => this.logger.warn(`Email order confirm failed: ${err.message}`));
  }
}
