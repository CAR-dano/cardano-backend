/*
 * --------------------------------------------------------------------------
 * File: customer-vehicles.controller.ts
 * Project: car-dano-backend
 * --------------------------------------------------------------------------
 * Description: REST controller that allows authenticated customers to manage
 * their registered vehicles (CRUD metadata and photos).
 * --------------------------------------------------------------------------
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerVehiclesService } from './customer-vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { CustomerVehicleListResponseDto, CustomerVehicleResponseDto } from './dto/customer-vehicle-response.dto';
import { CreateCustomerVehicleDto } from './dto/create-customer-vehicle.dto';
import { UpdateCustomerVehicleDto } from './dto/update-customer-vehicle.dto';
import { CustomerVehicleListQueryDto } from './dto/customer-vehicle-list-query.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileValidationPipe } from '../inspections/pipes/file-validation.pipe';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Express } from 'express';

@ApiTags('Customer Vehicles')
@ApiBearerAuth('JwtAuthGuard')
@Controller('me/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class CustomerVehiclesController {
  constructor(private readonly vehiclesService: CustomerVehiclesService) {}

  private coercePhotoMetadata<T extends CreateCustomerVehicleDto | UpdateCustomerVehicleDto>(payload: T): T {
    if (payload && typeof (payload as any).photos === 'string') {
      try {
        (payload as any).photos = JSON.parse((payload as any).photos);
      } catch (error) {
        throw new BadRequestException('Invalid photos JSON payload.');
      }
    }
    return payload;
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'List registered vehicles owned by the customer' })
  @ApiOkResponse({
    description: 'Paginated list of vehicles.',
    type: CustomerVehicleListResponseDto,
  })
  async listVehicles(
    @GetUser() user: UserResponseDto,
    @Query() query: CustomerVehicleListQueryDto,
  ): Promise<CustomerVehicleListResponseDto> {
    return this.vehiclesService.listVehicles(user.id, query);
  }

  @Get(':vehicleId')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get detail of a registered vehicle' })
  @ApiOkResponse({ description: 'Vehicle detail with photos.', type: CustomerVehicleResponseDto })
  @ApiNotFoundResponse({ description: 'Vehicle not found or unauthorized.' })
  async getVehicle(
    @GetUser() user: UserResponseDto,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<CustomerVehicleResponseDto> {
    return this.vehiclesService.getVehicle(user.id, vehicleId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: memoryStorage(),
    }),
  )
  @ApiOperation({ summary: 'Register a new vehicle with mandatory front photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Vehicle metadata and photo metadata (JSON). Files uploaded under `photos` field.',
    type: CreateCustomerVehicleDto,
  })
  @ApiOkResponse({ description: 'Created vehicle.', type: CustomerVehicleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or missing mandatory photo.' })
  async createVehicle(
    @GetUser() user: UserResponseDto,
    @Body() body: CreateCustomerVehicleDto,
    @UploadedFiles(new FileValidationPipe()) files: Express.Multer.File[],
  ): Promise<CustomerVehicleResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one photo is required.');
    }
    const normalized = this.coercePhotoMetadata(body);
    return this.vehiclesService.createVehicle(user.id, normalized, files);
  }

  @Put(':vehicleId')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: memoryStorage(),
    }),
  )
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Update vehicle metadata and optionally replace photos' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Updated vehicle.', type: CustomerVehicleResponseDto })
  async updateVehicle(
    @GetUser() user: UserResponseDto,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() body: UpdateCustomerVehicleDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<CustomerVehicleResponseDto> {
    const photoFiles = body.photos && body.photos.length > 0 ? files ?? [] : [];
    if (body.photos && body.photos.length > 0) {
      if (!files || files.length === 0) {
        throw new BadRequestException('Photo files are required to replace existing photos.');
      }
      // Validate files using FileValidationPipe manually when provided
      const validator = new FileValidationPipe();
      await validator.transform(photoFiles, {
        type: 'custom',
        metatype: undefined,
        data: undefined,
      });
    }
    const normalized = this.coercePhotoMetadata(body);
    return this.vehiclesService.updateVehicle(user.id, vehicleId, normalized, photoFiles);
  }
}
