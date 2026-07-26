import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEarlyAccessDto {
  @ApiProperty({ example: 'sutrisno@example.com', description: 'Email for the new account' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', description: 'Password for the new account' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: 'Phone number (optional)' })
  @IsOptional()
  @IsString()
  phone?: string;
}
