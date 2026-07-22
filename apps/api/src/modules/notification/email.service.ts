import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
import { PrismaService } from '../../common/database/prisma.service';

interface MailInfo {
  messageId: string;
}

interface MailTransport {
  sendMail(opts: { from: string; to: string; subject: string; html: string }): Promise<MailInfo>;
}

/**
 * Gmail REST API transport — sends email via HTTPS (port 443) instead of SMTP,
 * bypassing firewall blocks on SMTP ports (465/587).
 */
class GmailApiTransport implements MailTransport {
  private oauth2: OAuth2Client;
  private userEmail: string;

  constructor(clientId: string, clientSecret: string, refreshToken: string, userEmail: string) {
    this.oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2.setCredentials({ refresh_token: refreshToken });
    this.userEmail = userEmail;
  }

  async sendMail(opts: { from: string; to: string; subject: string; html: string }): Promise<MailInfo> {
    // Build RFC 2822 raw email
    const boundary = '----=_Part_' + Math.random().toString(36).slice(2);
    const fromHeader = opts.from || this.userEmail;
    const lines = [
      `From: ${fromHeader}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(opts.html).toString('base64'),
      `--${boundary}--`,
      '',
    ];
    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2 });
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
    return { messageId: res.data.id || '' };
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: MailTransport | null = null;
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

  private async buildTransporter(): Promise<MailTransport | null> {
    const cfg = await this.getEmailConfig();

    // 1) Gmail OAuth2 connected via the Admin panel — uses Gmail REST API
    //    (HTTPS port 443) instead of SMTP, bypassing firewall blocks.
    if (
      cfg['email.provider'] === 'gmail' &&
      cfg['email.clientId'] && cfg['email.clientSecret'] &&
      cfg['email.refreshToken'] && cfg['email.connectedEmail']
    ) {
      this.fromAddress = cfg['email.from'] || `Digsan <${cfg['email.connectedEmail']}>`;
      this.logger.log(`Email transporter: Gmail REST API (${cfg['email.connectedEmail']})`);
      return new GmailApiTransport(
        cfg['email.clientId'],
        cfg['email.clientSecret'],
        cfg['email.refreshToken'],
        cfg['email.connectedEmail'],
      );
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

    // 3) Legacy Gmail OAuth2 from env variables — also use REST API.
    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
    const refreshToken = this.configService.get('GOOGLE_REFRESH_TOKEN');
    const smtpUser = this.configService.get('SMTP_USER');
    if (clientId && clientSecret && refreshToken && smtpUser) {
      this.fromAddress = this.configService.get('SMTP_FROM', this.fromAddress);
      this.logger.log(`Email transporter: Gmail REST API (env) (${smtpUser})`);
      return new GmailApiTransport(clientId, clientSecret, refreshToken, smtpUser);
    }

    this.logger.warn('Email credentials not configured — emails will be logged only');
    return null;
  }

  private async getTransporter(): Promise<MailTransport | null> {
    if (!this.loaded) {
      try {
        this.transporter = await this.buildTransporter();
      } catch (err) {
        const msg = String(err?.message || err);
        if (msg.includes('invalid_grant')) {
          this.logger.error(
            'Email transporter init failed: Gmail refresh token is expired or revoked (invalid_grant). ' +
            'Admin must reconnect via /admin/settings → Connect with Google, or set SMTP_* env vars.',
          );
        } else {
          this.logger.error(`Failed to init email transporter: ${err}`);
        }
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
      const msg = String(err?.message || err);
      // invalid_grant = refresh token expired/revoked. Invalidate so the next
      // attempt rebuilds the transporter (picks up new credentials from DB/env).
      if (msg.includes('invalid_grant')) {
        this.logger.error(
          'Gmail refresh token expired/revoked (invalid_grant). Invalidating transporter. ' +
          'Admin must reconnect via /admin/settings.',
        );
        this.invalidate();
      } else {
        this.logger.error(`Failed to send email to ${to}: ${err}`);
      }
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

  async sendTreeInvitationEmail(
    to: string,
    inviterName: string,
    treeName: string,
    acceptUrl: string,
    message?: string,
    inviterAvatar?: string | null,
    webUrl?: string,
  ) {
    const safeMsg = (message || '').trim();
    const logoUrl = `${webUrl || ''}/logo-white.svg`;
    const avatarHtml = inviterAvatar
      ? `<img src="${inviterAvatar}" alt="${inviterName}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.15)" referrerpolicy="no-referrer" />`
      : `<div style="width:56px;height:56px;border-radius:50%;background:#3B82F6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.15)">${(inviterName || '?')[0].toUpperCase()}</div>`;

    const html = this.wrapTemplate(`
      <div style="text-align:center;margin-bottom:24px">
        <img src="${logoUrl}" alt="Digsan" style="height:36px;width:auto" />
      </div>
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:12px">
        <div style="flex-shrink:0">${avatarHtml}</div>
        <div style="flex:1;min-width:0">
          <p style="margin:0 0 4px;color:#1e293b;font-size:16px;font-weight:600">${inviterName}</p>
          <p style="margin:0;color:#64748b;font-size:14px">Mengundang Anda ke silsilah keluarga</p>
          <p style="margin:4px 0 0;color:#3B82F6;font-size:15px;font-weight:600">${treeName}</p>
        </div>
      </div>
      ${safeMsg ? `<blockquote style="margin:0 0 24px;padding:12px 16px;background:#f1f5f9;border-left:4px solid #3B82F6;color:#334155;font-size:15px;border-radius:0 8px 8px 0">${safeMsg.replace(/</g, '&lt;')}</blockquote>` : ''}
      <div style="text-align:center;margin:32px 0">
        <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background:#10B981;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
          Terima Undangan
        </a>
      </div>
      <p style="color:#94a3b8;font-size:14px">Dengan menerima, Anda dapat melihat dan melengkapi profil Anda dalam silsilah tersebut. Link ini berlaku selama 7 hari.</p>
    `, true);
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

  wrapTemplate(content: string, skipHeader = false): string {
    const header = skipHeader
      ? ''
      : `<div style="background:linear-gradient(135deg,#1e3a5f,#3B82F6);padding:32px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:28px">Digsan</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">Platform Keluarga Indonesia</p>
        </div>`;
    return `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        ${header}
        <div style="padding:32px">${content}</div>
        <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="color:#94a3b8;font-size:12px;margin:0">&copy; ${new Date().getFullYear()} Digsan. All rights reserved.</p>
        </div>
      </div>
    `;
  }
}
