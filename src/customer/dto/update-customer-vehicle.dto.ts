import { PartialType } from '@nestjs/swagger';
import { CreateCustomerVehicleDto } from './create-customer-vehicle.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerVehiclePhotoMetadataDto } from './customer-vehicle-photo-meta.dto';

export class UpdateCustomerVehicleDto extends PartialType(CreateCustomerVehicleDto) {
  @ApiPropertyOptional({
    type: () => CustomerVehiclePhotoMetadataDto,
    isArray: true,
    description: 'Optional photo metadata for replacing existing photos. Provide files alongside this payload.',
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CustomerVehiclePhotoMetadataDto)
  photos?: CustomerVehiclePhotoMetadataDto[];
}
