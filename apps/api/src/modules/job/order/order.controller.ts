import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('Job - Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('jobs/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job order' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get orders for current user' })
  @ApiQuery({ name: 'role', required: false, enum: ['customer', 'provider'] })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.findAll(userId, {
      role: (role as any) ?? 'customer',
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('by-number/:orderNumber')
  @ApiOperation({ summary: 'Get order by order number' })
  async findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.orderService.findByOrderNumber(orderNumber, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.orderService.findOne(id, userId);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status (confirm, reject, start, complete, cancel)' })
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, userId, dto);
  }

  @Put(':id/assign')
  @ApiOperation({ summary: 'Assign a provider/worker to a pending order' })
  async assignProvider(
    @Param('id') orderId: string,
    @Body() dto: { providerId: string },
  ) {
    return this.orderService.assignProvider(orderId, dto.providerId);
  }
}
