import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehiclePhotoType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class CustomerVehiclePhotoMetadataDto {
  @ApiProperty({ enum: VehiclePhotoType })
  @IsEnum(VehiclePhotoType)
  type!: VehiclePhotoType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
