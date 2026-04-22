import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, PaymentWebhookDto, UploadPaymentProofDto } from './dto/create-payment.dto';

@ApiTags('Job - Payments')
@Controller('jobs/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a payment for an order' })
  async createPayment(@CurrentUser('id') userId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.createPayment(userId, dto);
  }

  @Get('order/:orderId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get payment for an order' })
  async getPayment(@Param('orderId') orderId: string, @CurrentUser('id') userId: string) {
    return this.paymentService.getPayment(orderId, userId);
  }

  @Put(':id/proof')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Upload payment proof image' })
  async uploadProof(
    @Param('id') paymentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UploadPaymentProofDto,
  ) {
    return this.paymentService.uploadProof(paymentId, userId, dto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Payment gateway webhook (iPaymu / Midtrans)' })
  async handleWebhook(@Body() dto: PaymentWebhookDto) {
    return this.paymentService.handleWebhook(dto);
  }

  @Put(':id/confirm')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Admin: Confirm manual payment' })
  async confirmPayment(@Param('id') paymentId: string) {
    return this.paymentService.confirmPayment(paymentId);
  }
}
