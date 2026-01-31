/*
 * --------------------------------------------------------------------------
 * File: dashboard.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for handling dashboard data retrieval and processing.
 * Provides methods to fetch various statistics like main counters, order trends,
 * branch distribution, and inspector performance.
 * Utilizes Prisma for database interactions and date-fns for date calculations.
 * --------------------------------------------------------------------------
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { GetDashboardStatsDto } from './dto/get-dashboard-stats.dto';
import {
  InspectorPerformanceItemDto,
  InspectorPerformanceResponseDto,
} from './dto/inspector-performance-response.dto';
import {
  OrderTrendItemDto,
  OrderTrendResponseDto,
} from './dto/order-trend-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionStatus, Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
// import { GetOrderTrendDto, OrderTrendRangeType } from './dto/get-order-trend.';
import {
  startOfDay,
  endOfDay,
  isAfter,
  isBefore,
  startOfMonth,
  differenceInDays,
  format,
  addHours,
  addDays,
  addMonths,
  endOfMonth,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export interface BranchDistributionItem {
  branch: string;
  count: number;
  percentage: string;
  change: string;
}

export interface BranchDistributionResponse {
  total: number;
  totalChange: string;
  branchDistribution: BranchDistributionItem[];
}

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Calculates the percentage change between a current and previous value.
   *
   * @param current The current value.
   * @param previous The previous value.
   * @returns A string representing the percentage change (e.g., "+10.5%", "-5.2%", "0.0%").
   */
  private calculateChangePercentage(current: number, previous: number): string {
    if (previous === 0) {
      return current > 0 ? '+100.0%' : '0.0%';
    }
    const changeValue = ((current - previous) / previous) * 100;
    return `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
  }

  /**
   * Validates and returns a date range based on provided start and end date strings.
   * Ensures the start date is not after the end date and adjusts times to start/end of day in the specified timezone.
   *
   * @param startDateStr The start date string (YYYY-MM-DD).
   * @param endDateStr The end date string (YYYY-MM-DD).
   * @param timezone The timezone to use for date interpretation (default: 'Asia/Jakarta').
   * @returns An object containing the validated start and end Date objects.
   * @throws BadRequestException if start_date or end_date are missing or if start_date is after end_date.
   */
  private getValidatedDateRange(
    startDateStr?: string,
    endDateStr?: string,
    timezone: string = 'Asia/Jakarta',
  ): { start: Date; end: Date } {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('start_date and end_date are required.');
    }
    const startInterpreted = new Date(`${startDateStr}T00:00:00`);
    const endInterpreted = new Date(`${endDateStr}T23:59:59`);

    const startInTimezone = toZonedTime(startInterpreted, timezone);
    const endInTimezone = toZonedTime(endInterpreted, timezone);

    if (isAfter(startInTimezone, endInTimezone)) {
      throw new BadRequestException('start_date cannot be after end_date.');
    }

    return {
      start: fromZonedTime(startOfDay(startInTimezone), timezone),
      end: fromZonedTime(endOfDay(endInTimezone), timezone),
    };
  }

  /**
   * Calculates the current and previous date ranges based on a given date range.
   * The previous range has the same duration as the current range and ends one day before the current range starts.
   *
   * @param startDateStr The start date string for the current period (YYYY-MM-DD).
   * @param endDateStr The end date string for the current period (YYYY-MM-DD).
   * @param timezone The timezone to use for date calculations (default: 'Asia/Jakarta').
   * @returns An object containing the current and previous date ranges.
   */
  private calculateDateRanges(
    startDateStr: string,
    endDateStr: string,
    timezone: string = 'Asia/Jakarta',
  ): { current: DateRange; previous: DateRange } {
    const { start: actualStartDate, end: actualEndDate } =
      this.getValidatedDateRange(startDateStr, endDateStr, timezone);

    const duration = actualEndDate.getTime() - actualStartDate.getTime();
    const previousEndDate = new Date(actualStartDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - duration);

    return {
      current: { start: actualStartDate, end: actualEndDate },
      previous: { start: previousStartDate, end: previousEndDate },
    };
  }

  /**
   * Retrieves the total count of inspections and counts by status within a specified date range.
   *
   * @param startDate The start date of the period (UTC).
   * @param endDate The end date of the period (UTC).
   * @returns A promise that resolves to an object containing the total count and counts by status.
   */
  private async getInspectionCountsInPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, number>> {
    const countsByStatus = await this.prisma.inspection.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        status: true,
      },
    });

    // Format the results from groupBy into an easy-to-use object
    const statusCounts = countsByStatus.reduce((acc: Record<string, number>, current) => {
      acc[current.status] = current._count.status;
      return acc;
    }, {});

    // Calculate total from individual status counts
    const total = Object.values(statusCounts).reduce(
      (sum: number, count: number) => sum + count,
      0,
    );

    return {
      total,
      ...statusCounts,
    };
  }

  /**
   * Retrieves main dashboard counter statistics (total orders, need review, approved, etc.)
   * for a specified date range and compares them to the previous period.
   *
   * @param query The query parameters containing start_date, end_date, and timezone.
   * @returns A promise that resolves to an object containing the main counter data with counts and change percentages.
   * @throws BadRequestException if start_date or end_date are missing.
   */
  async getMainCounter(query: GetDashboardStatsDto) {
    const { start_date, end_date, timezone } = query;

    if (!start_date || !end_date) {
      throw new BadRequestException(
        'start_date and end_date are required for this operation.',
      );
    }

    // --- Caching Logic Start ---
    const listVersion =
      (await this.redisService.get('inspections:list_version')) || '1';
    const cacheKey = `dashboard:main-stats:v${listVersion}:${start_date}:${end_date}:${timezone || 'Asia/Jakarta'}`;

    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cachedData);
      }
    } catch (error) {
      this.logger.warn(`Redis error while fetching cache: ${error.message}`);
    }
    // --- Caching Logic End ---

    const { current, previous } = this.calculateDateRanges(
      start_date,
      end_date,
      timezone,
    );

    const [currentPeriodData, previousPeriodData] = await Promise.all([
      this.getInspectionCountsInPeriod(current.start, current.end),
      this.getInspectionCountsInPeriod(previous.start, previous.end),
    ]);
    const createCounterData = (status: InspectionStatus | 'totalOrders') => {
      const key = status === 'totalOrders' ? 'total' : status;
      const currentCount = currentPeriodData[key] || 0;
      const previousCount = previousPeriodData[key] || 0;

      return {
        count: currentCount,
        changePercentage: this.calculateChangePercentage(
          currentCount,
          previousCount,
        ),
      };
    };

    const response = {
      totalOrders: createCounterData('totalOrders'),
      needReview: createCounterData(InspectionStatus.NEED_REVIEW),
      approved: createCounterData(InspectionStatus.APPROVED),
      archived: createCounterData(InspectionStatus.ARCHIVED),
      failArchive: createCounterData(InspectionStatus.FAIL_ARCHIVE),
      deactivated: createCounterData(InspectionStatus.DEACTIVATED),
    };

    // --- Cache the response ---
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        3600 * 24, // Cache for 24 hours (invalidated by version increment)
      );
    } catch (error) {
      this.logger.warn(`Redis error while setting cache: ${error.message}`);
    }

    return response;
  }

  /**
   * Generates a list of time periods based on the specified date range and granularity.
   *
   * @param startDate The start date of the range (UTC).
   * @param endDate The end date of the range (UTC).
   * @param granularity The desired time granularity ('hour', 'day', or 'month').
   * @param timezone The timezone to use for period labeling and boundary calculations (default: 'Asia/Jakarta').
   * @returns An array of OrderTrendItemDto representing the generated periods.
   */
  private generatePeriods(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'month',
    timezone: string = 'Asia/Jakarta',
  ): OrderTrendItemDto[] {
    switch (granularity) {
      case 'hour':
        return this.generateHourlyPeriods(startDate, timezone);
      case 'day':
        return this.generateDailyPeriods(startDate, endDate, timezone);
      case 'month':
        return this.generateMonthlyPeriods(startDate, endDate, timezone);
      default:
        return [];
    }
  }

  /**
   * Generates a list of hourly periods within a single day for order trend analysis.
   * Periods are 2 hours long.
   *
   * @param startDate The start date of the day (UTC).
   * @param timezone The timezone to use for period labeling and boundary calculations.
   * @returns An array of OrderTrendItemDto representing the hourly periods.
   */
  private generateHourlyPeriods(
    startDate: Date, // This date is the actualStartDateUsed in UTC
    timezone: string,
  ): OrderTrendItemDto[] {
    const periods: OrderTrendItemDto[] = [];
    // Get the start of the day in the specified timezone
    const startOfTargetDayInTimezone = startOfDay(
      toZonedTime(startDate, timezone),
    );

    for (let i = 0; i < 24; i += 2) {
      // Calculate period start and end in the specified timezone
      const periodStartInTimezone = addHours(startOfTargetDayInTimezone, i);
      const periodEndInTimezone = addHours(periodStartInTimezone, 2);

      // Convert period start and end to UTC for the period_start/end properties
      const periodStartUTC = fromZonedTime(periodStartInTimezone, timezone); // UTC representation of start of period in timezone
      const periodEndUTC = fromZonedTime(periodEndInTimezone, timezone);

      periods.push({
        period_label: `${format(periodStartInTimezone, 'HH:00')}-${format(periodEndInTimezone, 'HH:00')}`,
        period_start: periodStartUTC,
        period_end: periodEndUTC,
        count: 0,
      });
    }
    return periods;
  }

  /**
   * Generates a list of daily periods within a specified date range.
   *
   * @param startDate The start date of the range (UTC).
   * @param endDate The end date of the range (UTC).
   * @param timezone The timezone to use for period labeling and boundary calculations.
   * @returns An array of OrderTrendItemDto representing the daily periods.
   */
  private generateDailyPeriods(
    startDate: Date,
    endDate: Date,
    timezone: string,
  ): OrderTrendItemDto[] {
    const periods: OrderTrendItemDto[] = [];
    let current = startDate;
    while (isBefore(current, endDate) || isSameDay(current, endDate)) {
      // Get the start of the day in the specified timezone, then convert to UTC to match trendDataMap keys
      const startOfDayInTimezone = startOfDay(toZonedTime(current, timezone));
      const periodStartUTC = fromZonedTime(startOfDayInTimezone, timezone);

      periods.push({
        period_label: format(toZonedTime(current, timezone), 'dd MMM'),
        period_start: periodStartUTC,
        period_end: fromZonedTime(
          endOfDay(toZonedTime(current, timezone)),
          timezone,
        ),
        count: 0,
      });
      current = addDays(current, 1);
    }
    return periods;
  }

  /**
   * Generates a list of monthly periods within a specified date range.
   *
   * @param startDate The start date of the range (UTC).
   * @param endDate The end date of the range (UTC).
   * @param timezone The timezone to use for period labeling and boundary calculations.
   * @returns An array of OrderTrendItemDto representing the monthly periods.
   */
  private generateMonthlyPeriods(
    startDate: Date,
    endDate: Date,
    timezone: string,
  ): OrderTrendItemDto[] {
    const periods: OrderTrendItemDto[] = [];
    let current = startOfMonth(startDate);
    while (isBefore(current, endDate) || isSameMonth(current, endDate)) {
      const monthInTimezone = toZonedTime(current, timezone);
      periods.push({
        period_label: format(monthInTimezone, 'MMM yyyy'),
        period_start: fromZonedTime(startOfMonth(monthInTimezone), timezone),
        period_end: fromZonedTime(endOfMonth(monthInTimezone), timezone),
        count: 0,
      });
      current = addMonths(current, 1);
    }
    return periods;
  }

  /**
   * Retrieves aggregated inspection data (counts) for a specified date range and granularity.
   *
   * @param startDate The start date of the range (UTC).
   * @param endDate The end date of the range (UTC).
   * @param granularity The desired time granularity ('hour', 'day', or 'month').
   * @param timezone The timezone to use for aggregation grouping (default: 'Asia/Jakarta').
   * @returns A promise that resolves to a Map where keys are period identifiers (ISO strings) and values are counts.
   */
  private async getAggregatedInspectionData(
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'month',
    timezone: string = 'Asia/Jakarta',
  ): Promise<Map<string, number>> {
    if (granularity === 'hour') {
      const query = Prisma.sql`
      SELECT
        DATE_TRUNC('day', "createdAt" AT TIME ZONE ${timezone}) +
        INTERVAL '1 hour' * (floor(EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${timezone}) / 2) * 2)
        AS period_group,
        COUNT(*)::integer AS count
      FROM "inspections"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY period_group
      ORDER BY period_group ASC;`;
      const results: { period_group: Date; count: number }[] =
        await this.prisma.$queryRaw(query);

      const dataMap = new Map<string, number>();
      for (const result of results) {
        dataMap.set(result.period_group.toISOString(), result.count);
      }
      return dataMap;
    } else {
      // For daily/monthly, generate periods and count for each period
      const periods = this.generatePeriods(
        startDate,
        endDate,
        granularity,
        timezone,
      );
      const dataMap = new Map<string, number>();

      for (const period of periods) {
        const count = await this.prisma.inspection.count({
          where: {
            createdAt: {
              gte: period.period_start, // Use period start in UTC
              lte: period.period_end, // Use period end in UTC
            },
          },
        });
        // The key should be the UTC midnight of the date in the specified timezone
        const dateInTimezone = toZonedTime(period.period_start, timezone);
        const lookupKey = format(
          startOfDay(dateInTimezone),
          "yyyy-MM-dd'T'00:00:00.000'Z'",
        );
        dataMap.set(lookupKey, count);
      }
      return dataMap;
    }
  }

  /**
   * Retrieves order trend data based on the provided query parameters.
   * The granularity of the trend data (hourly, daily, or monthly) is determined by the duration of the date range.
   *
   * @param query The query parameters containing start_date, end_date, and timezone.
   * @returns A promise that resolves to an OrderTrendResponseDto containing the trend data and summary.
   */
  async getOrderTrend(
    query: GetDashboardStatsDto,
  ): Promise<OrderTrendResponseDto> {
    const { start: actualStartDateUsed, end: actualEndDateUsed } =
      this.getValidatedDateRange(
        query.start_date,
        query.end_date,
        query.timezone,
      );

    const durationInDays = differenceInDays(
      actualEndDateUsed,
      actualStartDateUsed,
    );
    let granularity: 'hour' | 'day' | 'month';

    if (durationInDays === 0) {
      granularity = 'hour'; // If start & end are on the same day -> hourly trend
    } else if (durationInDays <= 92) {
      granularity = 'day'; // If range <= 92 days (3 months) -> daily trend
    } else {
      granularity = 'month'; // If range > 92 days (3 months) -> monthly trend
    }

    const periods = this.generatePeriods(
      actualStartDateUsed,
      actualEndDateUsed,
      granularity,
      query.timezone,
    );

    if (periods.length === 0) {
      return {
        data: [],
        summary: {
          total_orders: 0,
          actual_start_date_used: actualStartDateUsed.toISOString(),
          actual_end_date_used: actualEndDateUsed.toISOString(),
        },
      };
    }
    const trendDataMap = await this.getAggregatedInspectionData(
      actualStartDateUsed,
      actualEndDateUsed,
      granularity,
      query.timezone,
    );

    const finalData = periods.map((period) => {
      let lookupKey: string;
      if (granularity === 'hour') {
        // For hourly, subtract 7 hours from period.period_start (UTC representation of start of period in timezone)
        // to match the trendDataMap keys format
        lookupKey = addHours(period.period_start, -7).toISOString();
      } else {
        // For daily/monthly, use the previous logic (UTC midnight of the date in the specified timezone)
        const dateInTimezone = toZonedTime(
          period.period_start,
          query.timezone || 'Asia/Jakarta',
        );
        lookupKey = format(
          startOfDay(dateInTimezone),
          "yyyy-MM-dd'T'00:00:00.000'Z'",
        );
      }

      return {
        ...period,
        count: trendDataMap.get(lookupKey) || 0,
      };
    });

    this.logger.log('trendDataMap', trendDataMap);
    this.logger.log('finalData', finalData);

    const totalOrders = finalData.reduce((sum, item) => sum + item.count, 0);

    return {
      data: finalData,
      summary: {
        total_orders: totalOrders,
        actual_start_date_used: actualStartDateUsed.toISOString(),
        actual_end_date_used: actualEndDateUsed.toISOString(),
      },
    };
  }

  /**
   * Retrieves order distribution data by branch for a specified date range.
   * Calculates the count, percentage, and change compared to the previous period for each branch.
   *
   * @param query The query parameters containing start_date, end_date, and timezone.
   * @returns A promise that resolves to a BranchDistributionResponse containing the total count, total change, and branch distribution data.
   * @throws BadRequestException if start_date or end_date are missing.
   */
  async getBranchDistribution(
    query: GetDashboardStatsDto,
  ): Promise<BranchDistributionResponse> {
    const { start_date, end_date, timezone } = query;

    if (!start_date || !end_date) {
      throw new BadRequestException(
        'start_date and end_date are required for this operation.',
      );
    }

    // --- Caching Logic Start ---
    const listVersion =
      (await this.redisService.get('inspections:list_version')) || '1';
    const cacheKey = `dashboard:branch-distribution:v${listVersion}:${start_date}:${end_date}:${timezone || 'Asia/Jakarta'}`;

    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cachedData);
      }
    } catch (error) {
      this.logger.warn(`Redis error while fetching cache: ${error.message}`);
    }
    // --- Caching Logic End ---

    const { current, previous } = this.calculateDateRanges(
      start_date,
      end_date,
      timezone,
    );

    // 1. Fetch all unique branch cities for mapping
    const branchCities = await this.prisma.inspectionBranchCity.findMany({
      select: {
        id: true,
        city: true,
      },
      where: {
        isActive: true,
      },
    });

    const branchMap = new Map(branchCities.map((b) => [b.id, b.city]));

    // 2. Optimized: Get current period distribution in one query
    const currentCounts = await this.prisma.inspection.groupBy({
      by: ['branchCityId'],
      where: {
        createdAt: {
          gte: current.start,
          lte: current.end,
        },
      },
      _count: {
        id: true,
      },
    });

    // 3. Optimized: Get previous period distribution in one query
    const previousCounts = await this.prisma.inspection.groupBy({
      by: ['branchCityId'],
      where: {
        createdAt: {
          gte: previous.start,
          lte: previous.end,
        },
      },
      _count: {
        id: true,
      },
    });

    const currentCountsMap = new Map(
      currentCounts.map((c) => [c.branchCityId, c._count.id]),
    );
    const previousCountsMap = new Map(
      previousCounts.map((p) => [p.branchCityId, p._count.id]),
    );

    // 4. Calculate totals for percentages and change
    const totalInspectionsCurrentPeriod = currentCounts.reduce(
      (sum, c) => sum + c._count.id,
      0,
    );
    const totalInspectionsPreviousPeriod = previousCounts.reduce(
      (sum, p) => sum + p._count.id,
      0,
    );

    // 5. Build final distribution data
    const branchDistribution: BranchDistributionItem[] = branchCities.map(
      (branchCity) => {
        const currentCount = currentCountsMap.get(branchCity.id) || 0;
        const previousCount = previousCountsMap.get(branchCity.id) || 0;

        const percentage =
          totalInspectionsCurrentPeriod > 0
            ? ((currentCount / totalInspectionsCurrentPeriod) * 100).toFixed(
              1,
            ) + '%'
            : '0.0%';

        return {
          branch: branchCity.city,
          count: currentCount,
          percentage: percentage,
          change: this.calculateChangePercentage(currentCount, previousCount),
        };
      },
    );

    const response: BranchDistributionResponse = {
      total: totalInspectionsCurrentPeriod,
      totalChange: this.calculateChangePercentage(
        totalInspectionsCurrentPeriod,
        totalInspectionsPreviousPeriod,
      ),
      branchDistribution: branchDistribution,
    };

    // --- Cache the response ---
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        3600 * 24, // Cache for 24 hours
      );
    } catch (error) {
      this.logger.warn(`Redis error while setting cache: ${error.message}`);
    }

    return response;
  }

  /**
   * Retrieves inspector performance data for a specified date range.
   * Calculates the total inspections performed by each inspector within the period.
   *
   * @param query The query parameters containing start_date, end_date, and timezone.
   * @returns A promise that resolves to an InspectorPerformanceResponseDto containing the performance data.
   */
  async getInspectorPerformance(
    query: GetDashboardStatsDto,
  ): Promise<InspectorPerformanceResponseDto> {
    const { start_date, end_date, timezone } = query;

    // --- Caching Logic Start ---
    const listVersion =
      (await this.redisService.get('inspections:list_version')) || '1';
    const cacheKey = `dashboard:inspector-performance:v${listVersion}:${start_date}:${end_date}:${timezone || 'Asia/Jakarta'}`;

    try {
      const cachedData = await this.redisService.get(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        return JSON.parse(cachedData);
      }
    } catch (error) {
      this.logger.warn(`Redis error while fetching cache: ${error.message}`);
    }
    // --- Caching Logic End ---

    const { start, end } = this.getValidatedDateRange(
      start_date,
      end_date,
      timezone,
    );

    // Fetch all active inspectors first to ensure we show them even if they have 0 inspections
    const inspectors = await this.prisma.user.findMany({
      where: {
        role: 'INSPECTOR',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Optimized: Use groupBy to get all counts in one query
    const performanceCounts = await this.prisma.inspection.groupBy({
      by: ['inspectorId'],
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        inspectorId: {
          in: inspectors.map((i) => i.id),
        },
      },
      _count: {
        id: true,
      },
    });

    const countsMap = new Map(
      performanceCounts.map((item) => [item.inspectorId, item._count.id]),
    );

    const performanceData: InspectorPerformanceItemDto[] = inspectors
      .filter((i) => !!i.name)
      .map((inspector) => ({
        inspector: inspector.name!,
        totalInspections: countsMap.get(inspector.id) || 0,
      }));

    const response = { data: performanceData };

    // --- Cache the response ---
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(response),
        3600 * 24, // Cache for 24 hours
      );
    } catch (error) {
      this.logger.warn(`Redis error while setting cache: ${error.message}`);
    }

    return response;
  }
}
