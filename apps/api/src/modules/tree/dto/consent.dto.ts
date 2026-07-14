import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestConsentDto {
  @ApiProperty({ description: 'Node key in the tree layout (e.g. "parent-1")' })
  @IsString()
  nodeId!: string;

  @ApiPropertyOptional({ description: 'Account id of the living person, if already known' })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Email of the living person (used to notify/link)' })
  @IsOptional()
  @IsEmail()
  targetEmail?: string;

  @ApiPropertyOptional({ description: 'Phone of the living person (used to notify/link)' })
  @IsOptional()
  @IsString()
  targetPhone?: string;

  @ApiPropertyOptional({ description: 'Optional message to the person' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RespondConsentDto {
  @ApiProperty({ description: 'true = grant, false = reject' })
  @IsBoolean()
  grant!: boolean;
}
