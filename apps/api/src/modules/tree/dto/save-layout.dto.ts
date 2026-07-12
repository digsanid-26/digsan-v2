import { IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SaveLayoutDto {
  @ApiPropertyOptional({
    description: 'Config-driven tree setup (spouse/child/parent counts, family names, etc.)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Member overrides keyed by synthetic node id (self, parent-0, child-0, ...)',
  })
  @IsOptional()
  @IsObject()
  members?: Record<string, unknown>;
}
