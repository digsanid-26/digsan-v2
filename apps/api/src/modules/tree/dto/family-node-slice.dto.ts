import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveFamilyNodeSliceDto {
  @ApiProperty({
    description:
      'Partial member map keyed by node id. Only nodes inside the caller\'s own slice (their circle and its descendants) are accepted.',
  })
  @IsObject()
  members!: Record<string, unknown>;
}
