import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = 'Digsan <noreply@digsan.id>';
  private loaded = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Clears the cached transporter so the next send rebuilds it from the latest
   * config. Call this after the admin connects/disconnects a Gmail account.
   */
  invalidate() {
    this.transporter = null;
    this.loaded = false;
  }

  private async getEmailConfig(): Promise<Record<string, string>> {
    try {
      const rows = await this.prisma.appConfig.findMany({ where: { category: 'email' } });
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      return map;
    } catch {
      return {};
    }
  }

  private async buildTransporter(): Promise<nodemailer.Transporter | null> {
    const cfg = await this.getEmailConfig();

    // 1) Gmail OAuth2 connected via the Admin panel (mirrors wp-mail-smtp's
    //    "Authorization / Connect" flow). Nodemailer refreshes access tokens
    //    automatically from the stored refresh token.
    if (
      cfg['email.provider'] === 'gmail' &&
      cfg['email.clientId'] && cfg['email.clientSecret'] &&
      cfg['email.refreshToken'] && cfg['email.connectedEmail']
    ) {
      this.fromAddress = cfg['email.from'] || `Digsan <${cfg['email.connectedEmail']}>`;
      this.logger.log(`Email transporter: Gmail OAuth (${cfg['email.connectedEmail']})`);
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: cfg['email.connectedEmail'],
          clientId: cfg['email.clientId'],
          clientSecret: cfg['email.clientSecret'],
          refreshToken: cfg['email.refreshToken'],
        },
      });
    }

    // 2) Generic SMTP (env) — "Other SMTP" mailer; works with Google via
    //    smtp.gmail.com + App Password.
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (smtpHost) {
      const port = parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10);
      const secureEnv = this.configService.get<string>('SMTP_SECURE');
      const secure = secureEnv != null ? secureEnv === 'true' : port === 465;
      const user = this.configService.get<string>('SMTP_USER');
      const pass = this.configService.get<string>('SMTP_PASS');
      this.fromAddress = this.configService.get('SMTP_FROM', this.fromAddress);
      this.logger.log(`Email transporter: SMTP ${smtpHost}:${port} (secure=${secure})`);
      return nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    }

    // 3) Legacy Gmail OAuth2 from env variables.
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get('GOOGLE_REFRESH_TOKEN');
    const smtpUser = this.configService.get('SMTP_USER');
    if (clientId && clientSecret && refreshToken && smtpUser) {
      this.fromAddress = this.configService.get('SMTP_FROM', this.fromAddress);
      this.logger.log('Email transporter: Gmail OAuth2 (env)');
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { type: 'OAuth2', user: smtpUser, clientId, clientSecret, refreshToken },
      });
    }

    this.logger.warn('Email credentials not configured — emails will be logged only');
    return null;
  }

  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    if (!this.loaded) {
      try {
        this.transporter = await this.buildTransporter();
      } catch (err) {
        this.logger.error(`Failed to init email transporter: ${err}`);
        this.transporter = null;
      }
      this.loaded = true;
    }
    return this.transporter;
  }

  async sendEmail(to: string, subject: string, html: string) {
    const transporter = await this.getTransporter();

    if (!transporter) {
      this.logger.warn(`[DEV] Email to ${to} | Subject: ${subject}`);
      this.logger.debug(html);
      return;
    }

    try {
      const info = await transporter.sendMail({ from: this.fromAddress, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${err}`);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, name: string, token: string) {
    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
    const verifyUrl = `${webUrl}/verify-email?token=${token}`;
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Halo ${name}!</h2>
      <p style="color:#475569;font-size:16px">Terima kasih telah mendaftar di <strong>Digsan</strong>.</p>
      <p style="color:#475569;font-size:16px">Klik tombol berikut untuk verifikasi email Anda:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:#3B82F6;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
          Verifikasi Email
        </a>
      </div>
      <p style="color:#94a3b8;font-size:14px">Link ini berlaku selama 24 jam. Jika Anda tidak mendaftar di Digsan, abaikan email ini.</p>
    `);
    return this.sendEmail(to, 'Verifikasi Email Digsan', html);
  }

  async sendPasswordResetEmail(to: string, name: string, token: string) {
    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
    const resetUrl = `${webUrl}/reset-password?token=${token}`;
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Reset Password</h2>
      <p style="color:#475569;font-size:16px">Halo ${name}, kami menerima permintaan reset password akun Digsan Anda.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#EF4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
          Reset Password
        </a>
      </div>
      <p style="color:#94a3b8;font-size:14px">Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.</p>
    `);
    return this.sendEmail(to, 'Reset Password Digsan', html);
  }

  async sendTreeInvitationEmail(to: string, inviterName: string, treeName: string, acceptUrl: string, message?: string) {
    const safeMsg = (message || '').trim();
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Undangan Silsilah Keluarga</h2>
      <p style="color:#475569;font-size:16px"><strong>${inviterName}</strong> mengundang Anda untuk bergabung & melengkapi silsilah keluarga <strong>${treeName}</strong> di Digsan.</p>
      ${safeMsg ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f1f5f9;border-left:4px solid #3B82F6;color:#334155;font-size:15px">${safeMsg.replace(/</g, '&lt;')}</blockquote>` : ''}
      <div style="text-align:center;margin:32px 0">
        <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
          Terima Undangan
        </a>
      </div>
      <p style="color:#94a3b8;font-size:14px">Dengan menerima, Anda dapat mengelola profil Anda sendiri dalam silsilah tersebut. Link ini berlaku selama 7 hari.</p>
    `);
    return this.sendEmail(to, `Undangan Silsilah Keluarga ${treeName}`, html);
  }

  // ─── JOB EMAIL TEMPLATES ──────────────────────────────────

  async sendOrderCreatedEmail(to: string, name: string, orderNumber: string, serviceName: string, totalPrice: number) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Pesanan Dibuat</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Pesanan Anda berhasil dibuat.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">No. Pesanan</td><td style="padding:8px 0;font-weight:600">#${orderNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Layanan</td><td style="padding:8px 0;font-weight:600">${serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:600">Rp ${totalPrice.toLocaleString('id-ID')}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:14px">Buka aplikasi Digsan untuk detail dan status pesanan.</p>
    `);
    return this.sendEmail(to, `Pesanan #${orderNumber} Dibuat`, html);
  }

  async sendOrderConfirmedEmail(to: string, name: string, orderNumber: string, serviceName: string, totalPrice: number) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Pesanan Dikonfirmasi</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Pesanan <strong>#${orderNumber}</strong> telah dikonfirmasi oleh pekerja.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">Layanan</td><td style="padding:8px 0;font-weight:600">${serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Total</td><td style="padding:8px 0;font-weight:600">Rp ${totalPrice.toLocaleString('id-ID')}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:14px">Pekerja akan datang sesuai jadwal yang ditentukan.</p>
    `);
    return this.sendEmail(to, `Pesanan #${orderNumber} Dikonfirmasi`, html);
  }

  async sendOrderCompletedEmail(to: string, name: string, orderNumber: string) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Pesanan Selesai</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Pesanan <strong>#${orderNumber}</strong> telah selesai dikerjakan.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="#" style="display:inline-block;padding:14px 32px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
          Beri Ulasan
        </a>
      </div>
      <p style="color:#94a3b8;font-size:14px">Ulasan Anda membantu pekerja lain meningkatkan kualitas layanan.</p>
    `);
    return this.sendEmail(to, `Pesanan #${orderNumber} Selesai`, html);
  }

  async sendPaymentSuccessEmail(to: string, name: string, orderNumber: string, amount: number) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Pembayaran Berhasil</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Pembayaran untuk pesanan <strong>#${orderNumber}</strong> telah berhasil.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">Jumlah</td><td style="padding:8px 0;font-weight:600">Rp ${amount.toLocaleString('id-ID')}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:14px">Terima kasih telah menggunakan Digsan.</p>
    `);
    return this.sendEmail(to, `Pembayaran #${orderNumber} Berhasil`, html);
  }

  async sendNewWorkerOrderEmail(to: string, name: string, orderNumber: string, serviceName: string, customerName: string) {
    const html = this.wrapTemplate(`
      <h2 style="color:#1e293b;margin:0 0 16px">Pesanan Baru</h2>
      <p style="color:#475569;font-size:16px">Halo ${name},</p>
      <p style="color:#475569;font-size:16px">Anda mendapat pesanan baru dari <strong>${customerName}</strong>.</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#64748b">No. Pesanan</td><td style="padding:8px 0;font-weight:600">#${orderNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Layanan</td><td style="padding:8px 0;font-weight:600">${serviceName}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:14px">Buka aplikasi Digsan untuk konfirmasi pesanan.</p>
    `);
    return this.sendEmail(to, `Pesanan Baru #${orderNumber}`, html);
  }

  wrapTemplate(content: string): string {
    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:linear-gradient(135deg,#1e3a5f,#3B82F6);padding:32px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:28px">Digsan</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">Platform Keluarga Indonesia</p>
        </div>
        <div style="padding:32px">${content}</div>
        <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="color:#94a3b8;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} Digsan. All rights reserved.</p>
        </div>
      </div>
    `;
  }
}
