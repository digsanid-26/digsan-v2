import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class RespondLinkRequestDto {
  @ApiProperty({ description: 'true = "ya, ini saya", false = tolak' })
  @IsBoolean()
  approve!: boolean;
}
