import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiPropertyOptional({ example: 'sutrisno@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'parent-1', description: 'Layout node key this invitation is for' })
  @IsOptional()
  @IsString()
  nodeId?: string;

  @ApiPropertyOptional({ example: 'Yuk lengkapi data keluarga kita!' })
  @IsOptional()
  @IsString()
  message?: string;
}
