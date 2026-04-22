import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'JobService ID' })
  @IsString()
  serviceId: string;

  @ApiPropertyOptional({ description: 'SubCategory ID (auto-resolved from service if omitted)' })
  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @ApiProperty({ description: 'Address ID for the job location' })
  @IsString()
  addressId: string;

  @ApiProperty({ example: 'Perbaikan keran bocor di dapur' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2026-04-10' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  scheduledTime: string;

  @ApiProperty({ example: 2, description: 'Duration in hours' })
  @IsInt()
  @Min(1)
  duration: number;

  @ApiPropertyOptional({ enum: ['PER_JAM', 'PER_PROJECT'], default: 'PER_JAM' })
  @IsOptional()
  @IsString()
  pricingType?: string;

  @ApiPropertyOptional({ description: 'Preferred provider/worker user ID' })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ example: 'Tolong bawa peralatan sendiri' })
  @IsOptional()
  @IsString()
  customerNotes?: string;
}
