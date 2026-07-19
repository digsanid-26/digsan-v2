import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/database/prisma.service';
import { EmailService } from '../notification/email.service';

const CATEGORY = 'email';
// mail.google.com is required for SMTP XOAUTH2 (nodemailer 'gmail' service);
// userinfo.email lets us read the connected account address.
const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Admin-configurable Gmail OAuth ("Authorization / Connect") flow, modeled on
 * the wp-mail-smtp Gmail mailer: the admin saves a Client ID/Secret, clicks
 * "Connect", authorizes via Google, and we persist the refresh token + the
 * connected email so EmailService can send through that account.
 */
@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private redirectUri(): string {
    return this.config.get<string>(
      'GMAIL_OAUTH_REDIRECT_URL',
      'http://localhost:4000/api/admin/email/gmail/callback',
    );
  }

  private async getCfg(): Promise<Record<string, string>> {
    const rows = await this.prisma.appConfig.findMany({ where: { category: CATEGORY } });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  private async setCfg(key: string, value: string) {
    await this.prisma.appConfig.upsert({
      where: { key },
      create: { key, value, category: CATEGORY, type: 'string' },
      update: { value },
    });
  }

  private async delCfg(...keys: string[]) {
    await this.prisma.appConfig.deleteMany({ where: { key: { in: keys } } });
  }

  // ─── STATUS ───────────────────────────────────────────────

  async getStatus() {
    const cfg = await this.getCfg();
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const connected = cfg['email.provider'] === 'gmail' && !!cfg['email.refreshToken'];

    let provider: string;
    if (connected) provider = 'gmail';
    else if (smtpHost) provider = 'smtp';
    else if (this.config.get('GOOGLE_REFRESH_TOKEN')) provider = 'gmail_env';
    else provider = 'console';

    return {
      provider,
      connected,
      connectedEmail: cfg['email.connectedEmail'] || null,
      hasClientId: !!cfg['email.clientId'],
      hasClientSecret: !!cfg['email.clientSecret'],
      redirectUri: this.redirectUri(),
      smtpEnvHost: smtpHost || null,
    };
  }

  // ─── CREDENTIALS ──────────────────────────────────────────

  async saveCredentials(clientId: string, clientSecret: string) {
    if (!clientId.trim() || !clientSecret.trim()) {
      throw new BadRequestException('Client ID dan Client Secret wajib diisi');
    }
    await this.setCfg('email.clientId', clientId.trim());
    await this.setCfg('email.clientSecret', clientSecret.trim());
    return { message: 'Kredensial Google berhasil disimpan' };
  }

  // ─── OAUTH CONNECT / CALLBACK ─────────────────────────────

  async buildConnectUrl(adminId: string) {
    const cfg = await this.getCfg();
    if (!cfg['email.clientId'] || !cfg['email.clientSecret']) {
      throw new BadRequestException('Simpan Client ID & Client Secret terlebih dahulu');
    }

    const oauth2 = new google.auth.OAuth2(
      cfg['email.clientId'],
      cfg['email.clientSecret'],
      this.redirectUri(),
    );

    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // force a refresh_token even on re-auth
      scope: GMAIL_SCOPES,
      state: this.signState(adminId),
    });

    return { url };
  }

  async handleCallback(code: string, state: string) {
    if (!this.verifyState(state)) {
      throw new BadRequestException('State tidak valid atau kadaluarsa');
    }

    const cfg = await this.getCfg();
    if (!cfg['email.clientId'] || !cfg['email.clientSecret']) {
      throw new BadRequestException('Kredensial Google tidak ditemukan');
    }

    const oauth2 = new google.auth.OAuth2(
      cfg['email.clientId'],
      cfg['email.clientSecret'],
      this.redirectUri(),
    );

    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google tidak mengembalikan refresh token. Cabut akses aplikasi di akun Google lalu ulangi.',
      );
    }

    oauth2.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    const email = data.email || '';

    await this.setCfg('email.refreshToken', tokens.refresh_token);
    await this.setCfg('email.connectedEmail', email);
    await this.setCfg('email.provider', 'gmail');
    this.email.invalidate();

    this.logger.log(`Gmail connected for outbound email: ${email}`);
    return { email };
  }

  async disconnect() {
    await this.delCfg('email.refreshToken', 'email.connectedEmail', 'email.provider');
    this.email.invalidate();
    return { message: 'Koneksi Gmail telah diputus' };
  }

  // ─── TEST ─────────────────────────────────────────────────

  async sendTest(to: string) {
    if (!to.trim()) throw new BadRequestException('Alamat email tujuan wajib diisi');
    await this.email.sendEmail(
      to.trim(),
      'Tes Email Digsan',
      this.email.wrapTemplate(`
        <h2 style="color:#1e293b;margin:0 0 16px">Tes Email Berhasil</h2>
        <p style="color:#475569;font-size:16px">Jika Anda menerima email ini, konfigurasi pengiriman email Digsan sudah berfungsi dengan benar.</p>
        <p style="color:#94a3b8;font-size:14px">Dikirim dari panel Admin Digsan.</p>
      `),
    );
    return { message: `Email tes dikirim ke ${to.trim()}` };
  }

  // ─── SIGNED STATE (HMAC over JWT_SECRET) ──────────────────

  private signState(adminId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ a: adminId, e: Date.now() + 10 * 60 * 1000 }),
    ).toString('base64url');
    return `${payload}.${this.hmac(payload)}`;
  }

  private verifyState(state: string): boolean {
    if (!state || !state.includes('.')) return false;
    const [payload, sig] = state.split('.');
    if (!payload || !sig || this.hmac(payload) !== sig) return false;
    try {
      const { e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return typeof e === 'number' && e > Date.now();
    } catch {
      return false;
    }
  }

  private hmac(data: string): string {
    const secret = this.config.get<string>('JWT_SECRET', 'digsan-dev-secret');
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }
}
