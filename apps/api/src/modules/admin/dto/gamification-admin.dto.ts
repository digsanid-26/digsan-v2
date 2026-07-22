import {
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── POINT TYPE DTOs ───────────────────────────────────────────

export class CreatePointTypeDto {
  @ApiProperty({ example: 'pengabdian' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Poin Pengabdian' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'Poin dari pengabdian task & koneksi keluarga' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'heart' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdatePointTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── POINT LOG QUERY DTO ───────────────────────────────────────

export class PointLogQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by point type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO string)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

// ─── REWARD DTOs ───────────────────────────────────────────────

export class CreateRewardDto {
  @ApiProperty({ example: 'Voucher 50rb' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Voucher belanja 50.000' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'gift' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointCost: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}

export class UpdateRewardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pointCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── REDEEM DTOs ───────────────────────────────────────────────

export class RedeemQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'] })
  @IsOptional()
  @IsString()
  status?: string;
}

export class RedeemStatusDto {
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'] })
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
