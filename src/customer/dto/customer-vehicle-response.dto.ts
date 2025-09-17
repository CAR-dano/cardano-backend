import { ApiProperty } from '@nestjs/swagger';
import {
  CustomerVehicle,
  CustomerVehiclePhoto,
  VehicleTransmission,
  VehicleType,
  VehiclePhotoType,
} from '@prisma/client';

export class CustomerVehiclePhotoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: VehiclePhotoType })
  type!: VehiclePhotoType;

  @ApiProperty()
  path!: string;

  @ApiProperty({ nullable: true })
  label!: string | null;

  @ApiProperty({ nullable: true })
  category!: string | null;

  @ApiProperty({ nullable: true })
  contentType!: string | null;

  @ApiProperty({ default: false })
  isPrimary!: boolean;

  @ApiProperty()
  displayOrder!: number;

  constructor(photo: CustomerVehiclePhoto) {
    this.id = photo.id;
    this.type = photo.type;
    this.path = photo.path;
    this.label = photo.label ?? null;
    this.category = photo.category ?? null;
    this.contentType = photo.contentType ?? null;
    this.isPrimary = photo.isPrimary;
    this.displayOrder = photo.displayOrder;
  }
}

export class CustomerVehicleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  plateNumber!: string;

  @ApiProperty()
  year!: number;

  @ApiProperty({ enum: VehicleTransmission })
  transmission!: VehicleTransmission;

  @ApiProperty({ enum: VehicleType })
  vehicleType!: VehicleType;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  model!: string;

  @ApiProperty()
  color!: string;

  @ApiProperty({ nullable: true })
  specification!: string | null;

  @ApiProperty({ nullable: true })
  serviceHistory!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: () => CustomerVehiclePhotoResponseDto, isArray: true })
  photos!: CustomerVehiclePhotoResponseDto[];

  constructor(vehicle: CustomerVehicle & { photos: CustomerVehiclePhoto[] }) {
    this.id = vehicle.id;
    this.plateNumber = vehicle.plateNumber;
    this.year = vehicle.year;
    this.transmission = vehicle.transmission;
    this.vehicleType = vehicle.vehicleType;
    this.brand = vehicle.brand;
    this.model = vehicle.model;
    this.color = vehicle.color;
    this.specification = vehicle.specification ?? null;
    this.serviceHistory = vehicle.serviceHistory ?? null;
    this.createdAt = vehicle.createdAt;
    this.updatedAt = vehicle.updatedAt;
    this.photos = (vehicle.photos ?? []).map((photo) => new CustomerVehiclePhotoResponseDto(photo));
  }
}

export class CustomerVehicleListResponseDto {
  @ApiProperty({ type: () => CustomerVehicleResponseDto, isArray: true })
  items!: CustomerVehicleResponseDto[];

  @ApiProperty()
  meta!: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
