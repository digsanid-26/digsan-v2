import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface IpaymuDirectPaymentRequest {
  name: string;
  phone: string;
  email: string;
  amount: number;
  notifyUrl: string;
  referenceId: string;
  product: string[];
  qty: number[];
  price: number[];
  description: string;
}

interface IpaymuDirectPaymentResponse {
  Status: number;
  Message: string;
  Data: {
    SessionID: string;
    TransactionId: string;
    ReferenceId: string;
    Via: string;
    Channel: string;
    PaymentNo: string;
    PaymentName: string;
    Total: number;
    Fee: number;
    Expired: string;
    QrImage?: string;
    QrString?: string;
  };
}

interface IpaymuCallbackData {
  trx_id: string;
  status: string;
  status_code: string;
  sid: string;
  reference_id: string;
  via: string;
  channel: string;
  amount: number;
  fee: number;
  created_date: string;
}

@Injectable()
export class IpaymuService {
  private readonly logger = new Logger(IpaymuService.name);
  private readonly apiKey: string;
  private readonly va: string;
  private readonly isProduction: boolean;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('IPAYMU_API_KEY') || '';
    this.va = this.configService.get<string>('IPAYMU_VA') || '';
    this.isProduction = this.configService.get<string>('IPAYMU_IS_PRODUCTION') === 'true';
    this.baseUrl = this.isProduction
      ? 'https://my.ipaymu.com/api/v2'
      : 'https://sandbox.ipaymu.com/api/v2';
  }

  /**
   * Generate signature untuk autentikasi iPaymu
   */
  private generateSignature(body: any, method: string = 'POST'): string {
    const bodyEncrypt = crypto
      .createHmac('sha256', this.apiKey)
      .update(JSON.stringify(body))
      .digest('hex');

    const stringToSign = `${method}:${this.va}:${bodyEncrypt}:${this.apiKey}`;
    
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(stringToSign)
      .digest('hex');
  }

  /**
   * Create direct payment transaction
   */
  async createDirectPayment(params: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    amount: number;
    productName: string;
    notifyUrl: string;
  }): Promise<IpaymuDirectPaymentResponse> {
    const body: IpaymuDirectPaymentRequest = {
      name: params.customerName,
      phone: params.customerPhone,
      email: params.customerEmail,
      amount: params.amount,
      notifyUrl: params.notifyUrl,
      referenceId: params.orderNumber,
      product: [params.productName],
      qty: [1],
      price: [params.amount],
      description: `Pembayaran order ${params.orderNumber}`,
    };

    const signature = this.generateSignature(body);

    try {
      const response = await fetch(`${this.baseUrl}/payment/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error('iPaymu API Error:', data);
        throw new Error(data.Message || 'Failed to create payment');
      }

      this.logger.log(`Payment created: ${data.Data.TransactionId}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create iPaymu payment:', error);
      throw error;
    }
  }

  /**
   * Verify callback signature
   */
  verifyCallback(signature: string, body: any): boolean {
    const calculatedSignature = this.generateSignature(body, 'POST');
    return signature === calculatedSignature;
  }

  /**
   * Parse callback data
   */
  parseCallback(body: any): IpaymuCallbackData {
    return {
      trx_id: body.trx_id,
      status: body.status,
      status_code: body.status_code,
      sid: body.sid,
      reference_id: body.reference_id,
      via: body.via,
      channel: body.channel,
      amount: parseFloat(body.amount),
      fee: parseFloat(body.fee),
      created_date: body.created_date,
    };
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(transactionId: string): Promise<any> {
    const body = { transactionId };
    const signature = this.generateSignature(body, 'POST');

    try {
      const response = await fetch(`${this.baseUrl}/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'va': this.va,
          'signature': signature,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error('iPaymu Check Status Error:', data);
        throw new Error(data.Message || 'Failed to check status');
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to check transaction status:', error);
      throw error;
    }
  }

  /**
   * Map iPaymu status to internal payment status
   */
  mapStatus(ipaymuStatus: string): 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' {
    switch (ipaymuStatus.toLowerCase()) {
      case 'berhasil':
      case 'success':
        return 'PAID';
      case 'pending':
        return 'PENDING';
      case 'expired':
        return 'EXPIRED';
      case 'gagal':
      case 'failed':
        return 'FAILED';
      case 'refund':
        return 'REFUNDED';
      default:
        this.logger.warn(`Unknown iPaymu status: ${ipaymuStatus}`);
        return 'PENDING';
    }
  }
}
