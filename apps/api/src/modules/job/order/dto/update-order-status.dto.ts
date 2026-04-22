import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrderStatusAction {
  CONFIRM = 'CONFIRM',
  REJECT = 'REJECT',
  START = 'START',
  COMPLETE = 'COMPLETE',
  CANCEL = 'CANCEL',
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatusAction, description: 'Action to perform on the order' })
  @IsEnum(OrderStatusAction)
  action: OrderStatusAction;

  @ApiPropertyOptional({ example: 'Tidak bisa hadir pada waktu tersebut' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: '09:15', description: 'Actual start time (for START action)' })
  @IsOptional()
  @IsString()
  actualStartTime?: string;

  @ApiPropertyOptional({ example: '11:00', description: 'Actual end time (for COMPLETE action)' })
  @IsOptional()
  @IsString()
  actualEndTime?: string;

  @ApiPropertyOptional({ description: 'Notes from provider or admin' })
  @IsOptional()
  @IsString()
  notes?: string;
}
