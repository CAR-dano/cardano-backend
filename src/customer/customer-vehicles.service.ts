/*
 * --------------------------------------------------------------------------
 * File: customer-vehicles.service.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: Business logic for customer vehicle registration, listing,
 * detail retrieval, metadata updates, and photo management. Works in tandem
 * with Backblaze storage for photo uploads and enforces ownership controls.
 * --------------------------------------------------------------------------
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BackblazeService } from '../common/services/backblaze.service';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import {
  CustomerVehicle,
  Prisma,
  VehiclePhotoType,
  VehicleTransmission,
  VehicleType,
} from '@prisma/client';
import { Express } from 'express';
import { CreateCustomerVehicleDto } from './dto/create-customer-vehicle.dto';
import { UpdateCustomerVehicleDto } from './dto/update-customer-vehicle.dto';
import {
  CustomerVehicleResponseDto,
  CustomerVehicleListResponseDto,
} from './dto/customer-vehicle-response.dto';
import { nanoid } from 'nanoid';

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class CustomerVehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BackblazeService,
    private readonly logger: AppLogger,
    private readonly audit: AuditLoggerService,
  ) {
    this.logger.setContext(CustomerVehiclesService.name);
  }

  private ensureTransmission(value: VehicleTransmission) {
    if (!Object.values(VehicleTransmission).includes(value)) {
      throw new BadRequestException('Invalid transmission value.');
    }
  }

  private ensureVehicleType(value: VehicleType) {
    if (!Object.values(VehicleType).includes(value)) {
      throw new BadRequestException('Invalid vehicle type value.');
    }
  }

  private validatePhotoPayload(
    dtoPhotos: CreateCustomerVehicleDto['photos'],
    files: Express.Multer.File[],
  ) {
    if (!dtoPhotos || dtoPhotos.length === 0) {
      throw new BadRequestException('Photo metadata is required.');
    }

    if (dtoPhotos.length !== files.length) {
      throw new BadRequestException(
        'Photos metadata count must match uploaded files count.',
      );
    }

    const frontMeta = dtoPhotos.find((photo) => photo.type === VehiclePhotoType.FRONT);
    if (!frontMeta) {
      throw new BadRequestException('Front photo (type FRONT) is required.');
    }
  }

  private buildPhotoKey(
    vehicleId: string,
    type: VehiclePhotoType,
    originalName: string,
  ): string {
    const safeExt = (originalName?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
    const slug = type.toLowerCase();
    return `uploads/customer-vehicles/${vehicleId}/${slug}-${Date.now()}-${nanoid(6)}.${safeExt}`;
  }

  private mapEntityToDto(vehicle: CustomerVehicle & { photos: any[] }): CustomerVehicleResponseDto {
    return new CustomerVehicleResponseDto(vehicle as any);
  }

  private async assertOwnership(userId: string, vehicleId: string) {
    const vehicle = await this.prisma.customerVehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, userId: true },
    });
    if (!vehicle || vehicle.userId !== userId) {
      throw new NotFoundException('Vehicle not found.');
    }
  }

  async listVehicles(
    userId: string,
    { page = 1, pageSize = 10 }: PaginationOptions,
  ): Promise<CustomerVehicleListResponseDto> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(50, pageSize));

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customerVehicle.count({ where: { userId } }),
      this.prisma.customerVehicle.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          photos: { orderBy: { displayOrder: 'asc' } },
        },
      }),
    ]);

    const dtos = rows.map((row) => this.mapEntityToDto(row));
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    return {
      items: dtos,
      meta: { total, page: safePage, pageSize: safePageSize, totalPages },
    };
  }

  async getVehicle(userId: string, vehicleId: string): Promise<CustomerVehicleResponseDto> {
    const vehicle = await this.prisma.customerVehicle.findFirst({
      where: { id: vehicleId, userId },
      include: { photos: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found.');
    }
    return this.mapEntityToDto(vehicle);
  }

  async createVehicle(
    userId: string,
    dto: CreateCustomerVehicleDto,
    files: Express.Multer.File[],
  ): Promise<CustomerVehicleResponseDto> {
    this.ensureTransmission(dto.transmission);
    this.ensureVehicleType(dto.vehicleType);
    this.validatePhotoPayload(dto.photos, files);

    try {
      const vehicle = await this.prisma.customerVehicle.create({
        data: {
          userId,
          plateNumber: dto.plateNumber,
          year: dto.year,
          transmission: dto.transmission,
          vehicleType: dto.vehicleType,
          brand: dto.brand,
          model: dto.model,
          color: dto.color,
          specification: dto.specification ?? null,
          serviceHistory: dto.serviceHistory ?? null,
        },
      });

      await this.persistPhotos(vehicle.id, dto.photos!, files);

      const fullVehicle = await this.prisma.customerVehicle.findUnique({
        where: { id: vehicle.id },
        include: { photos: { orderBy: { displayOrder: 'asc' } } },
      });

      this.audit.log({
        rid: 'n/a',
        actorId: userId,
        action: 'VEHICLE_CREATE',
        resource: 'customer_vehicle',
        subjectId: vehicle.id,
        result: 'SUCCESS',
      });

      return this.mapEntityToDto(fullVehicle!);
    } catch (error) {
      this.logger.error(
        `Failed to create vehicle for user ${userId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to create vehicle.');
    }
  }

  private async persistPhotos(
    vehicleId: string,
    photoMetas: NonNullable<CreateCustomerVehicleDto['photos']>,
    files: Express.Multer.File[],
  ) {
    const records: Prisma.CustomerVehiclePhotoCreateManyInput[] = [];
    for (const [index, meta] of photoMetas.entries()) {
      const file = files[index];
      const key = this.buildPhotoKey(vehicleId, meta.type, file.originalname);
      let url: string;
      try {
        url = await this.storage.uploadImageBuffer(
          file.buffer,
          key,
          file.mimetype || 'image/jpeg',
        );
      } catch (error) {
        this.logger.error(
          `Failed to upload customer vehicle photo for ${vehicleId}: ${(error as Error).message}`,
        );
        throw new InternalServerErrorException('Failed to upload photo.');
      }

      records.push({
        vehicleId,
        type: meta.type,
        label: meta.label ?? null,
        category: meta.category ?? null,
        path: url,
        storageKey: key,
        contentType: file.mimetype ?? null,
        isPrimary: meta.isPrimary ?? meta.type === VehiclePhotoType.FRONT,
        displayOrder: meta.displayOrder ?? index,
      });
    }

    await this.prisma.customerVehiclePhoto.createMany({ data: records });
  }

  async updateVehicle(
    userId: string,
    vehicleId: string,
    dto: UpdateCustomerVehicleDto,
    files: Express.Multer.File[],
  ): Promise<CustomerVehicleResponseDto> {
    await this.assertOwnership(userId, vehicleId);

    if (dto.transmission) this.ensureTransmission(dto.transmission);
    if (dto.vehicleType) this.ensureVehicleType(dto.vehicleType);

    if (dto.photos && dto.photos.length > 0) {
      this.validatePhotoPayload(dto.photos as any, files);
    }

    const data: Prisma.CustomerVehicleUpdateInput = {
      plateNumber: dto.plateNumber,
      year: dto.year,
      transmission: dto.transmission,
      vehicleType: dto.vehicleType,
      brand: dto.brand,
      model: dto.model,
      color: dto.color,
      specification: dto.specification,
      serviceHistory: dto.serviceHistory,
    };

    try {
      await this.prisma.customerVehicle.update({
        where: { id: vehicleId },
        data,
      });

      if (dto.photos && dto.photos.length > 0) {
        await this.replacePhotos(vehicleId, dto.photos, files);
      }

      const vehicle = await this.prisma.customerVehicle.findUnique({
        where: { id: vehicleId },
        include: { photos: { orderBy: { displayOrder: 'asc' } } },
      });

      this.audit.log({
        rid: 'n/a',
        actorId: userId,
        action: 'VEHICLE_UPDATE',
        resource: 'customer_vehicle',
        subjectId: vehicleId,
        result: 'SUCCESS',
      });

      return this.mapEntityToDto(vehicle!);
    } catch (error) {
      this.logger.error(
        `Failed to update vehicle ${vehicleId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to update vehicle.');
    }
  }

  private async replacePhotos(
    vehicleId: string,
    photoMetas: NonNullable<CreateCustomerVehicleDto['photos']>,
    files: Express.Multer.File[],
  ) {
    const existingPhotos = await this.prisma.customerVehiclePhoto.findMany({
      where: { vehicleId },
    });

    await this.prisma.customerVehiclePhoto.deleteMany({ where: { vehicleId } });

    for (const photo of existingPhotos) {
      if (photo.storageKey) {
        try {
          await this.storage.deleteFile(photo.storageKey);
        } catch (error) {
          this.logger.warn(
            `Failed to delete storage key ${photo.storageKey}: ${(error as Error).message}`,
          );
        }
      }
    }

    await this.persistPhotos(vehicleId, photoMetas, files);
  }
}
