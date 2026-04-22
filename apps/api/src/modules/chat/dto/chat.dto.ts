import { IsOptional, IsString, IsInt, IsEnum, IsArray, Min, Max, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDirectRoomDto {
  @ApiProperty({ description: 'ID of the other user' })
  @IsString()
  targetUserId: string;
}

export class CreateGroupRoomDto {
  @ApiProperty({ description: 'Group name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Member user IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];

  @ApiPropertyOptional({ enum: ['GROUP', 'FAMILY', 'ORDER'] })
  @IsOptional()
  @IsEnum(['GROUP', 'FAMILY', 'ORDER'])
  type?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (e.g. file URL)' })
  @IsOptional()
  metadata?: any;
}

export class MessageQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

export class AddMemberDto {
  @ApiProperty({ description: 'User ID to add' })
  @IsString()
  userId: string;
}
