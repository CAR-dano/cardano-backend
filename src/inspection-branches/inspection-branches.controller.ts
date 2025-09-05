/*
 * --------------------------------------------------------------------------
 * File: inspection-branches.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for managing inspection branch cities.
 * Handles incoming requests related to inspection branch cities,
 * delegates logic to the InspectionBranchesService, and returns responses.
 * Uses Swagger decorators for API documentation.
 * --------------------------------------------------------------------------
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { InspectionBranchesService } from './inspection-branches.service';
import { CreateInspectionBranchCityDto } from './dto/create-inspection-branch-city.dto';
import { UpdateInspectionBranchCityDto } from './dto/update-inspection-branch-city.dto';
import { InspectionBranchCityResponseDto } from './dto/inspection-branch-city-response.dto';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { HttpErrorResponseDto } from '../common/dto/http-error-response.dto';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

@ApiTags('Inspection Branches')
@Controller('inspection-branches')
export class InspectionBranchesController {
  constructor(
    private readonly inspectionBranchesService: InspectionBranchesService,
  ) {}

  /**
   * Creates a new inspection branch city.
   * Restricted to ADMIN role only.
   *
   * @param createInspectionBranchCityDto The data for creating the inspection branch city.
   * @returns A promise that resolves to the created InspectionBranchCityResponseDto.
   * @throws BadRequestException if the input data is invalid.
   * @throws UnauthorizedException if the user is not authenticated.
   * @throws ForbiddenException if the user does not have the required role.
   */
  @Post()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new inspection branch city' })
  @ApiBody({ type: CreateInspectionBranchCityDto })
  @ApiCreatedResponse({ description: 'Created.', type: InspectionBranchCityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input data.', type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.', type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ description: 'User lacks required role.', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async create(
    @Body() createInspectionBranchCityDto: CreateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.create(
      createInspectionBranchCityDto,
    );
  }

  /**
   * Retrieves all inspection branch cities.
   *
   * @returns A promise that resolves to an array of InspectionBranchCityResponseDto.
   */
  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Get all inspection branch cities' })
  @ApiOkResponse({ description: 'List of all inspection branch cities.', type: [InspectionBranchCityResponseDto] })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async findAll() {
    return await this.inspectionBranchesService.findAll();
  }

  /**
   * Retrieves an inspection branch city by its ID.
   *
   * @param id The ID of the inspection branch city.
   * @returns A promise that resolves to the InspectionBranchCityResponseDto.
   * @throws NotFoundException if the inspection branch city is not found.
   */
  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Get an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiOkResponse({ description: 'The inspection branch city details.', type: InspectionBranchCityResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection branch city not found.', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async findOne(@Param('id') id: string) {
    return this.inspectionBranchesService.findOne(id);
  }

  /**
   * Updates an existing inspection branch city by its ID.
   * Restricted to ADMIN role only.
   *
   * @param id The ID of the inspection branch city to update.
   * @param updateInspectionBranchCityDto The data for updating the inspection branch city.
   * @returns A promise that resolves to the updated InspectionBranchCityResponseDto.
   * @throws BadRequestException if the input data is invalid.
   * @throws UnauthorizedException if the user is not authenticated.
   * @throws ForbiddenException if the user does not have the required role.
   * @throws NotFoundException if the inspection branch city is not found.
   */
  @Put(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiBody({ type: UpdateInspectionBranchCityDto })
  @ApiOkResponse({ description: 'Updated.', type: InspectionBranchCityResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input data.', type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.', type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ description: 'User lacks required role.', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection branch city not found.', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateInspectionBranchCityDto: UpdateInspectionBranchCityDto,
  ) {
    return await this.inspectionBranchesService.update(
      id,
      updateInspectionBranchCityDto,
    );
  }

  /**
   * Deletes an inspection branch city by its ID.
   * Restricted to ADMIN role only.
   *
   * @param id The ID of the inspection branch city to delete.
   * @returns A promise that resolves to the deleted InspectionBranchCity.
   * @throws UnauthorizedException if the user is not authenticated.
   * @throws ForbiddenException if the user does not have the required role.
   * @throws NotFoundException if the inspection branch city is not found.
   */
  @Delete(':id')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an inspection branch city by ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiOkResponse({ description: 'Deleted.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.', type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ description: 'User lacks required role.', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection branch city not found.', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async remove(@Param('id') id: string) {
    return await this.inspectionBranchesService.remove(id);
  }

  /**
   * Toggles the active status of an inspection branch city by its ID.
   * Restricted to ADMIN and SUPERADMIN roles only.
   *
   * @param id The ID of the inspection branch city to toggle.
   * @returns A promise that resolves to the updated InspectionBranchCityResponseDto.
   * @throws UnauthorizedException if the user is not authenticated.
   * @throws ForbiddenException if the user does not have the required role.
   * @throws NotFoundException if the inspection branch city is not found.
   */
  @Patch(':id/toggle-active')
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle the active status of an inspection branch city by ID',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Inspection branch city ID',
  })
  @ApiOkResponse({ description: 'Active state updated.', type: InspectionBranchCityResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.', type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ description: 'User lacks required role.', type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ description: 'Inspection branch city not found.', type: HttpErrorResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.', type: HttpErrorResponseDto })
  async toggleActive(@Param('id') id: string) {
    return await this.inspectionBranchesService.toggleActive(id);
  }
}
