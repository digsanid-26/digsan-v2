import { Module } from '@nestjs/common';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { OrderController } from './order/order.controller';
import { OrderService } from './order/order.service';
import { WorkerController } from './worker/worker.controller';
import { WorkerService } from './worker/worker.service';
import { PaymentController } from './payment/payment.controller';
import { PaymentService } from './payment/payment.service';
import { IpaymuService } from './payment/ipaymu.service';
import { ReviewController } from './review/review.controller';
import { ReviewService } from './review/review.service';

@Module({
  controllers: [
    CatalogController,
    OrderController,
    WorkerController,
    PaymentController,
    ReviewController,
  ],
  providers: [
    CatalogService,
    OrderService,
    WorkerService,
    PaymentService,
    IpaymuService,
    ReviewService,
  ],
  exports: [
    CatalogService,
    OrderService,
    WorkerService,
    PaymentService,
    IpaymuService,
    ReviewService,
  ],
})
export class JobModule {}
