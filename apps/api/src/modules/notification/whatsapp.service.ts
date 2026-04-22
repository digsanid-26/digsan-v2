import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private configService: ConfigService) {}

  async sendMessage(phone: string, message: string) {
    const apiKey = this.configService.get('FONNTE_API_KEY');

    if (!apiKey) {
      this.logger.warn(`[DEV] WA to ${phone}: ${message}`);
      return { status: 'dev', detail: 'No FONNTE_API_KEY configured' };
    }

    try {
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: phone,
          message,
          countryCode: '62',
        }),
      });

      const data = await response.json();

      if (!data.status) {
        this.logger.error(`Fonnte API error: ${JSON.stringify(data)}`);
        throw new Error(data.reason || 'Fonnte send failed');
      }

      this.logger.log(`WA sent to ${phone}`);
      return data;
    } catch (err) {
      this.logger.error(`Failed to send WA to ${phone}: ${err}`);
      throw err;
    }
  }

  async sendOTP(phone: string, otp: string, name: string) {
    const message = `Halo ${name}! 👋\n\nKode OTP Digsan Anda: *${otp}*\n\nBerlaku 10 menit.\nJangan bagikan kode ini kepada siapapun.`;
    return this.sendMessage(phone, message);
  }

  async sendOrderNotification(phone: string, name: string, orderId: string, status: string) {
    const message = `Halo ${name}! 📋\n\nUpdate pesanan *#${orderId}*:\nStatus: *${status}*\n\nBuka app Digsan untuk detail.`;
    return this.sendMessage(phone, message);
  }

  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }
}
