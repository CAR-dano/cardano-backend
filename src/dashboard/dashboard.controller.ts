/*
 * --------------------------------------------------------------------------
 * File: dashboard.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Controller for handling dashboard-related requests.
 * Provides endpoints for retrieving various dashboard statistics and data.
 * Requires JWT authentication and ADMIN role for access.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger'; // Optional for Swagger documentation
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming you have a JWT guard
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { GetDashboardStatsDto } from './dto/get-dashboard-stats/get-dashboard-stats.dto';
import { MainStatsResponseDto } from './dto/main-stats-response.dto';
import { OrderTrendResponseDto } from './dto/order-trend-response.dto';
import { BranchDistributionResponseDto } from './dto/branch-distribution-response.dto';
import { InspectorPerformanceResponseDto } from './dto/inspector-performance-response.dto';
import { OverallValueDistributionResponseDto } from './dto/overall-value-distribution-response.dto';
import { CarBrandDistributionResponseDto } from './dto/car-brand-distribution-response.dto';
import { ProductionYearDistributionResponseDto } from './dto/production-year-distribution-response.dto';
import { TransmissionTypeDistributionResponseDto } from './dto/transmission-type-distribution-response.dto';
import { BlockchainStatusResponseDto } from './dto/blockchain-status-response.dto';
import { Role } from '@prisma/client';
// Import other DTOs as needed

@ApiTags('Dashboard Admin') // For Swagger
@ApiBearerAuth() // For Swagger, indicates endpoint requires a token
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) // Ensure JWTAuthGuard runs first
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('main-stats')
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiOperation({ summary: 'Get main order statistics' })
  @ApiResponse({
    status: 200,
    description: 'Main order statistics successfully retrieved.',
    type: MainStatsResponseDto,
  })
  /**
   * Retrieves main order statistics based on the provided query parameters.
   *
   * @param query - The query parameters for filtering statistics (e.g., time period, branch).
   * @returns A promise that resolves to the main statistics data.
   */
  async getMainStats(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getMainOrderStatistics(query);
  }

  @Get('order-trend')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get order trend data' })
  @ApiResponse({
    status: 200,
    description: 'Order trend data successfully retrieved.',
    type: OrderTrendResponseDto,
  })
  /**
   * Retrieves order trend data based on the provided query parameters.
   *
   * @param query - The query parameters for filtering the trend data (e.g., time period, branch).
   * @returns A promise that resolves to the order trend data.
   */
  getOrderTrend(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getOrderTrend(query);
  }

  @Get('branch-distribution')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order distribution by branch',
  })
  @ApiResponse({
    status: 200,
    description: 'Order distribution by branch successfully retrieved.',
    type: BranchDistributionResponseDto,
  })
  /**
   * Retrieves order distribution data by branch based on the provided query parameters.
   *
   * @param query - The query parameters for filtering the distribution data (e.g., time period, branch).
   * @returns A promise that resolves to the branch distribution data.
   */
  async getBranchDistribution(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getBranchDistribution(query);
  }

  @Get('inspector-performance')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get inspector performance' })
  @ApiResponse({
    status: 200,
    description: 'Inspector performance successfully retrieved.',
    type: InspectorPerformanceResponseDto,
  })
  /**
   * Retrieves inspector performance data based on the provided query parameters.
   *
   * @returns A promise that resolves to the inspector performance data.
   */
  async getInspectorPerformance() {
    return this.dashboardService.getInspectorPerformance();
  }

  @Get('overall-value-distribution')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order distribution by overall value',
  })
  @ApiResponse({
    status: 200,
    description: 'Order distribution by overall value successfully retrieved.',
    type: OverallValueDistributionResponseDto,
  })
  /**
   * Retrieves order distribution data by overall value.
   *
   * @returns A promise that resolves to the overall value distribution data.
   */
  getOverallValueDistribution() {
    return this.dashboardService.getOverallValueDistribution();
  }

  @Get('car-brand-distribution')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order distribution by car brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Order distribution by car brand successfully retrieved.',
    type: CarBrandDistributionResponseDto,
  })
  /**
   * Retrieves order distribution data by car brand.
   *
   * @returns A promise that resolves to the car brand distribution data.
   */
  async getCarBrandDistribution(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getCarBrandDistribution(query);
  }

  @Get('production-year-distribution')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order distribution by car production year',
  })
  @ApiResponse({
    status: 200,
    description:
      'Order distribution by car production year successfully retrieved.',
    type: ProductionYearDistributionResponseDto,
  })
  /**
   * Retrieves order distribution data by car production year.
   *
   * @returns A promise that resolves to the production year distribution data.
   */
  async getProductionYearDistribution(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getProductionYearDistribution(query);
  }

  @Get('transmission-type-distribution')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order distribution by car transmission type',
  })
  @ApiResponse({
    status: 200,
    description:
      'Order distribution by car transmission type successfully retrieved.',
    type: TransmissionTypeDistributionResponseDto,
  })
  /**
   * Retrieves order distribution data by car transmission type.
   *
   * @returns A promise that resolves to the transmission type distribution data.
   */
  getTransmissionTypeDistribution() {
    return this.dashboardService.getTransmissionTypeDistribution();
  }

  @Get('blockchain-status')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get order count by blockchain status',
  })
  @ApiResponse({
    status: 200,
    description: 'Order count by blockchain status successfully retrieved.',
    type: BlockchainStatusResponseDto,
  })
  /**
   * Retrieves the count of orders based on their blockchain status.
   *
   * @returns A promise that resolves to the blockchain status data.
   */
  getBlockchainStatus() {
    return this.dashboardService.getBlockchainStatus();
  }
}
