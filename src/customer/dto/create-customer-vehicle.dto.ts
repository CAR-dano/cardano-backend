import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import {
  VehicleTransmission,
  VehicleType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { CustomerVehiclePhotoMetadataDto } from './customer-vehicle-photo-meta.dto';

export class CreateCustomerVehicleDto {
  @ApiProperty({ description: 'Unique plate number within the user scope', example: 'AB1234CD' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 32)
  plateNumber!: string;

  @ApiProperty({ description: 'Manufacture year', example: 2020 })
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year!: number;

  @ApiProperty({ enum: VehicleTransmission })
  @IsEnum(VehicleTransmission)
  transmission!: VehicleTransmission;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @ApiProperty({ description: 'Vehicle brand/manufacturer', example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  brand!: string;

  @ApiProperty({ description: 'Vehicle model name', example: 'Alphard X' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  model!: string;

  @ApiProperty({ description: 'Dominant vehicle color', example: 'Black' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  color!: string;

  @ApiPropertyOptional({ description: 'Optional specification or notes' })
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional({ description: 'Optional service history' })
  @IsOptional()
  @IsString()
  serviceHistory?: string;

  @ApiProperty({
    type: () => CustomerVehiclePhotoMetadataDto,
    isArray: true,
    description: 'Metadata describing uploaded photos. Must include one FRONT type.',
  })
  @ValidateNested({ each: true })
  @Type(() => CustomerVehiclePhotoMetadataDto)
  photos!: CustomerVehiclePhotoMetadataDto[];
}
