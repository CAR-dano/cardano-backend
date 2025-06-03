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

import {
  Controller,
  Get,
  Post,
  UseGuards,
  Query,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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
import { SetInspectionTargetDto } from './dto/set-inspection-target.dto';
import { InspectionTargetStatsResponseDto } from './dto/inspection-target-stats.dto';
import { MainStatsResponseDto } from './dto/main-stats-response.dto';
import { OrderTrendResponseDto } from './dto/order-trend-response.dto';
import { GetOrderTrendDto } from './dto/get-order-trend/get-order-trend.dto';
import { BranchDistributionResponseDto } from './dto/branch-distribution-response.dto';
import { InspectorPerformanceResponseDto } from './dto/inspector-performance-response.dto';
import { InspectionStatsResponseDto } from './dto/inspection-stats-response.dto';
import { Role } from '@prisma/client';
import { InspectionTargetDto } from './dto/inspection-target.dto';
// Import other DTOs as needed

@ApiTags('Dashboard Admin') // For Swagger
@ApiBearerAuth() // For Swagger, indicates endpoint requires a token
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) // Ensure JWTAuthGuard runs first
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post('target')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Set inspection target for a period' })
  @ApiResponse({
    status: 200,
    description: 'Inspection target successfully set.',
    type: InspectionTargetDto,
  })
  async setInspectionTarget(@Body() dto: SetInspectionTargetDto) {
    return this.dashboardService.setInspectionTarget(dto);
  }

  @Get('target-stats')
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiOperation({ summary: 'Get inspection target statistics' })
  @ApiResponse({
    status: 200,
    description: 'Inspection target statistics successfully retrieved.',
    type: InspectionTargetStatsResponseDto,
  })
  async getInspectionTargetStats() {
    return this.dashboardService.getInspectionTargetStats();
  }

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
  @UsePipes(new ValidationPipe({ transform: true })) // Explicitly apply ValidationPipe with transform
  /**
   * Retrieves order trend data based on the provided query parameters.
   *
   * @param query - The query parameters for filtering the trend data (e.g., time period, branch).
   * @returns A promise that resolves to the order trend data.
   */
  getOrderTrend(@Query() query: GetOrderTrendDto) {
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

  @Get('inspection-review-stats')
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiOperation({
    summary: 'Get inspection statistics by status and time period',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspection statistics successfully retrieved.',
    type: InspectionStatsResponseDto,
  })
  /**
   * Retrieves inspection statistics (total, approved, need review, percentage reviewed)
   * for different time periods (all time, month, week, day).
   *
   * @returns A promise that resolves to the inspection statistics data.
   */
  async getInspectionStats() {
    return this.dashboardService.getInspectionReviewStats();
  }
}
