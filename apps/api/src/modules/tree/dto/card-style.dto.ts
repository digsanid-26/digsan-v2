import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCardStyleDto {
  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#333333' })
  @IsOptional()
  @IsString()
  textColor?: string;

  @ApiPropertyOptional({ example: '#cccccc' })
  @IsOptional()
  @IsString()
  borderColor?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  borderRadius?: number;

  @ApiPropertyOptional({ example: 'Inter' })
  @IsOptional()
  @IsString()
  fontFamily?: string;
}
