import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order ID to create payment for' })
  @IsString()
  orderId: string;

  @ApiProperty({ enum: ['BANK_TRANSFER', 'E_WALLET', 'CREDIT_CARD', 'CASH'] })
  @IsString()
  method: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ description: 'Transaction ID from payment gateway' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Transaction status from gateway' })
  @IsString()
  transactionStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fraudStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class UploadPaymentProofDto {
  @ApiProperty({ description: 'URL of the payment proof image' })
  @IsString()
  proofImage: string;
}
