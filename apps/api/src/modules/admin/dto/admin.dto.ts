import { IsOptional, IsString, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── USER MANAGEMENT ────────────────────────────────────────

export class AdminUserQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACTIVE', 'DORMANT', 'INACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by role name (e.g. user, worker, admin)' })
  @IsOptional()
  @IsString()
  role?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'DORMANT', 'INACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] })
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignRoleDto {
  @ApiProperty({ description: 'Role name to assign (e.g. admin, worker)' })
  @IsString()
  roleName: string;
}

// ─── WORKER MANAGEMENT ──────────────────────────────────────

export class AdminWorkerQueryDto {
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

  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by worker name' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateWorkerStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'SUSPENDED'] })
  @IsString()
  providerStatus: string;

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── ORDER MANAGEMENT ───────────────────────────────────────

export class AdminOrderQueryDto {
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

  @ApiPropertyOptional({ enum: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Search by order number' })
  @IsOptional()
  @IsString()
  search?: string;
}

// ─── SYSTEM SETTINGS ────────────────────────────────────────

export class UpdateSettingDto {
  @ApiProperty()
  @IsString()
  value: string;
}

export class CreateAppConfigDto {
  @ApiProperty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional({ default: 'string' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ default: 'general' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAppConfigDto {
  @ApiProperty()
  @IsString()
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
