import { IsString, IsOptional, IsBoolean, IsDateString, IsInt, IsEmail, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Sutrisno' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '1950-01-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: 'Surabaya' })
  @IsOptional()
  @IsString()
  birthPlace?: string;

  @ApiPropertyOptional({ example: '2020-12-01' })
  @IsOptional()
  @IsDateString()
  deathDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'sutrisno@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isWhatsapp?: boolean;

  @ApiPropertyOptional({ example: 'Kakek' })
  @IsOptional()
  @IsString()
  familyRole?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  childOrder?: number;

  @ApiPropertyOptional({ description: 'ID of parent member in the same tree' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'ID of spouse member in the same tree' })
  @IsOptional()
  @IsString()
  spouseId?: string;

  @ApiPropertyOptional({ description: 'Link to existing user account' })
  @IsOptional()
  @IsString()
  userId?: string;
}
