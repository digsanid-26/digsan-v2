import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ClaimNodeDto {
  @ApiProperty({ description: 'Slug of the family tree containing the node' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ description: 'Layout node id to claim (e.g. "older-0", "younger-1")' })
  @IsString()
  @IsNotEmpty()
  nodeId: string;
}
