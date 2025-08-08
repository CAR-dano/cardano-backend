/*
 * --------------------------------------------------------------------------
 * File: dashboard.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller responsible for handling dashboard-related requests.
 * Provides endpoints for retrieving various dashboard statistics and data including
 * main order statistics, order trends, branch distribution, and inspector performance.
 * Requires JWT authentication and ADMIN/REVIEWER roles for access to different endpoints.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, UseGuards, Query, Body } from '@nestjs/common';
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
import { GetDashboardStatsDto } from './dto/get-dashboard-stats.dto';
import { MainStatsResponseDto } from './dto/main-stats-response.dto';
import { OrderTrendResponseDto } from './dto/order-trend-response.dto';
import { BranchDistributionResponseDto } from './dto/branch-distribution-response.dto';
import { InspectorPerformanceResponseDto } from './dto/inspector-performance-response.dto';
import { Role } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Dashboard Admin') // For Swagger
@ApiBearerAuth() // For Swagger, indicates endpoint requires a token
@SkipThrottle()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard) // Ensure JWTAuthGuard runs first
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Retrieves main order statistics based on the provided query parameters.
   * Requires ADMIN or REVIEWER role.
   *
   * @param query - The query parameters for filtering statistics (e.g., time period).
   * @returns A promise that resolves to the main statistics data.
   */
  @Get('main-stats')
  @Roles(Role.ADMIN, Role.REVIEWER)
  @ApiOperation({ summary: 'Get main order statistics' })
  @ApiResponse({
    status: 200,
    description: 'Main order statistics successfully retrieved.',
    type: MainStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getMainStats(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getMainCounter(query);
  }

  /**
   * Retrieves order trend data based on the provided query parameters.
   * Requires ADMIN role.
   *
   * @param query - The query parameters for filtering the trend data (e.g., time period).
   * @returns A promise that resolves to the order trend data.
   */
  @Get('order-trend')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get order trend data' })
  @ApiResponse({
    status: 200,
    description: 'Order trend data successfully retrieved.',
    type: OrderTrendResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  getOrderTrend(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getOrderTrend(query);
  }

  /**
   * Retrieves order distribution data by branch based on the provided query parameters.
   * Requires ADMIN role.
   *
   * @param query - The query parameters for filtering the distribution data (e.g., time period).
   * @returns A promise that resolves to the branch distribution data.
   */
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
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getBranchDistribution(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getBranchDistribution(query);
  }

  /**
   * Retrieves inspector performance data.
   * Requires ADMIN role.
   *
   * @param query - The query parameters for filtering the performance data (e.g., time period).
   * @returns A promise that resolves to the inspector performance data.
   */
  @Get('inspector-performance')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get inspector performance' })
  @ApiResponse({
    status: 200,
    description: 'Inspector performance successfully retrieved.',
    type: InspectorPerformanceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getInspectorPerformance(@Query() query: GetDashboardStatsDto) {
    return this.dashboardService.getInspectorPerformance(query);
  }
}
