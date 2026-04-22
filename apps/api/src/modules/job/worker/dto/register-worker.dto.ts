import { IsString, IsOptional, IsInt, IsNumber, IsBoolean, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WorkerSkillDto {
  @ApiProperty({ description: 'SubCategory ID for the skill' })
  @IsString()
  subCategoryId: string;

  @ApiProperty({ enum: ['PER_JAM', 'PER_PROJECT'] })
  @IsString()
  pricingType: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  rate: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canProvideEquipment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentList?: string;
}

export class WorkScheduleDto {
  @ApiProperty({ example: 'Monday' })
  @IsString()
  dayOfWeek: string;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  endTime: string;
}

export class ServiceAreaDto {
  @ApiProperty({ example: 'Jakarta Selatan' })
  @IsString()
  areaName: string;
}

export class RegisterWorkerDto {
  @ApiPropertyOptional({ example: 'male' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(17)
  @Max(70)
  age?: number;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idCardPhoto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhoto?: string;

  @ApiPropertyOptional({ example: 'Tukang berpengalaman 10 tahun' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  intro?: string;

  @ApiPropertyOptional({ example: 'Jakarta Selatan' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiProperty({ type: [WorkerSkillDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerSkillDto)
  skills: WorkerSkillDto[];

  @ApiPropertyOptional({ type: [WorkScheduleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDto)
  workSchedules?: WorkScheduleDto[];

  @ApiPropertyOptional({ type: [ServiceAreaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  serviceAreas?: ServiceAreaDto[];
}
