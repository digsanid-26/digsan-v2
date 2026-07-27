import { IsString, IsOptional, IsBoolean, MaxLength, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTreeDto {
  @ApiPropertyOptional({ example: 'Keluarga Besar Sutrisno' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Silsilah keluarga dari kakek Sutrisno' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional({ example: 'https://example.com/family.png' })
  @IsOptional()
  @IsString()
  familyImage?: string;

  @ApiPropertyOptional({ example: 'Keluarga yang berdomisili di Surabaya' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  familyBio?: string;

  @ApiPropertyOptional({ example: '2000-01-15' })
  @IsOptional()
  @IsDateString()
  marriageDate?: string;

  @ApiPropertyOptional({ enum: ['ONGOING', 'DIVORCED', 'WIDOWED', 'NONE'] })
  @IsOptional()
  @IsIn(['ONGOING', 'DIVORCED', 'WIDOWED', 'NONE'])
  marriageStatus?: string;

  @ApiPropertyOptional({ example: 'Budi Sutrisno' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headName?: string;
}
