import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SetSlugDto {
  @ApiPropertyOptional({ description: 'Desired slug (auto-generated if empty)' })
  @IsOptional()
  @IsString()
  slug?: string;
}
