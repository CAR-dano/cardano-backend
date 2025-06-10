import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { GetDashboardStatsDto } from './dto/get-dashboard-stats.dto';
import { SetInspectionTargetDto } from './dto/set-inspection-target.dto';
import { InspectionTargetStatsResponseDto } from './dto/inspection-target-stats.dto';
import {
  InspectorPerformanceItemDto,
  InspectorPerformanceResponseDto,
} from './dto/inspector-performance-response.dto';
import {
  InspectionStatsPeriodData,
  InspectionStatsResponseDto,
} from './dto/inspection-stats-response.dto';
import {
  OrderTrendItemDto,
  OrderTrendResponseDto,
} from './dto/order-trend-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  InspectionStatus,
  Prisma,
  TargetPeriod,
  InspectionTarget,
} from '@prisma/client';
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
  getMonth,
  getYear,
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
  constructor(private readonly prisma: PrismaService) {}

  private calculateChangePercentage(current: number, previous: number): string {
    if (previous === 0) {
      return current > 0 ? '+100.0%' : '0.0%';
    }
    const changeValue = ((current - previous) / previous) * 100;
    return `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
  }

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

  private async getInspectionCountsInPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, number>> {
    const totalPromise = this.prisma.inspection.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const countsByStatusPromise = this.prisma.inspection.groupBy({
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

    // Jalankan kedua query secara bersamaan untuk efisiensi
    const [total, countsByStatus] = await Promise.all([
      totalPromise,
      countsByStatusPromise,
    ]);

    // Format hasil dari groupBy menjadi objek yang mudah digunakan
    const statusCounts = countsByStatus.reduce((acc, current) => {
      acc[current.status] = current._count.status;
      return acc;
    }, {});

    return {
      total,
      ...statusCounts,
    };
  }

  async getMainCounter(query: GetDashboardStatsDto) {
    const { start_date, end_date, timezone } = query;

    if (!start_date || !end_date) {
      // Kita bisa menggunakan kembali error dari fungsi aslinya.
      throw new BadRequestException(
        'start_date and end_date are required for this operation.',
      );
    }

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
    return {
      totalOrders: createCounterData('totalOrders'),
      needReview: createCounterData(InspectionStatus.NEED_REVIEW),
      approved: createCounterData(InspectionStatus.APPROVED),
      archived: createCounterData(InspectionStatus.ARCHIVED),
      failArchive: createCounterData(InspectionStatus.FAIL_ARCHIVE),
      deactivated: createCounterData(InspectionStatus.DEACTIVATED),
    };
  }

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
      granularity = 'hour'; // Jika start & end di hari yang sama -> tren per jam
    } else if (durationInDays <= 31) {
      granularity = 'day'; // Jika rentang <= 31 hari -> tren per hari
    } else {
      granularity = 'month'; // Jika rentang > 31 hari -> tren per bulan
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

  // async getBranchDistribution(
  //   query: GetDashboardStatsDto,
  // ): Promise<BranchDistributionResponse> {
  //   const { period, startDate, endDate } = query;
  //   const { start, end } = this.getDateRange(
  //     period ?? TimePeriod.ALL_TIME,
  //     startDate,
  //     endDate,
  //   );

  //   // Get all unique branch cities
  //   const branchCities = await this.prisma.inspectionBranchCity.findMany({
  //     select: {
  //       city: true,
  //     },
  //   });

  //   const branchDistribution: BranchDistributionItem[] = [];
  //   let totalInspectionsCurrentPeriod = 0;

  //   // Calculate total inspections for the current period first
  //   const totalInspectionsResult = await this.prisma.inspection.aggregate({
  //     _count: {
  //       id: true,
  //     },
  //     where: {
  //       createdAt: {
  //         gte: start,
  //         lte: end,
  //       },
  //     },
  //   });
  //   totalInspectionsCurrentPeriod = totalInspectionsResult._count.id;

  //   for (const branchCity of branchCities) {
  //     const currentPeriodCount = await this.prisma.inspection.count({
  //       where: {
  //         branchCity: {
  //           city: branchCity.city,
  //         },
  //         createdAt: {
  //           gte: start,
  //           lte: end,
  //         },
  //       },
  //     });

  //     // Calculate percentage for current period
  //     const percentage =
  //       totalInspectionsCurrentPeriod > 0
  //         ? (
  //             (currentPeriodCount / totalInspectionsCurrentPeriod) *
  //             100
  //           ).toFixed(1) + '%'
  //         : '0.0%';

  //     // Calculate previous period's range
  //     const { start: prevStart, end: prevEnd } = this.getPreviousDateRange(
  //       period ?? TimePeriod.ALL_TIME,
  //       start,
  //       end,
  //     );

  //     let previousPeriodCount = 0;
  //     if (prevStart || prevEnd) {
  //       // Only query if previous period is defined
  //       previousPeriodCount = await this.prisma.inspection.count({
  //         where: {
  //           branchCity: {
  //             city: branchCity.city,
  //           },
  //           createdAt: {
  //             gte: prevStart,
  //             lte: prevEnd,
  //           },
  //         },
  //       });
  //     }

  //     // Calculate change percentage
  //     let change = '0%';
  //     if (previousPeriodCount > 0) {
  //       const changeValue =
  //         ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) *
  //         100;
  //       change = `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
  //     } else if (currentPeriodCount > 0) {
  //       change = '+100%'; // If previous was 0 and current is > 0
  //     }

  //     branchDistribution.push({
  //       branch: branchCity.city,
  //       count: currentPeriodCount,
  //       percentage: percentage,
  //       change: change,
  //     });
  //   }

  //   // Handle 'Others' if there are inspections not tied to a specific branch city or if some branches are not listed
  //   // For simplicity, let's assume all inspections are tied to a branch city for now.
  //   // If there's a need for 'Others', it would involve querying inspections without a branchCityId.

  //   // Calculate total inspections for the previous period
  //   const { start: prevTotalStart, end: prevTotalEnd } =
  //     this.getPreviousDateRange(period ?? TimePeriod.ALL_TIME, start, end);

  //   let totalInspectionsPreviousPeriod = 0;
  //   if (prevTotalStart || prevTotalEnd) {
  //     const totalPrevInspectionsResult = await this.prisma.inspection.aggregate(
  //       {
  //         _count: {
  //           id: true,
  //         },
  //         where: {
  //           createdAt: {
  //             gte: prevTotalStart,
  //             lte: prevTotalEnd,
  //           },
  //         },
  //       },
  //     );
  //     totalInspectionsPreviousPeriod = totalPrevInspectionsResult._count.id;
  //   }

  //   // Calculate overall change percentage
  //   let totalChange = '0%';
  //   if (totalInspectionsPreviousPeriod > 0) {
  //     const changeValue =
  //       ((totalInspectionsCurrentPeriod - totalInspectionsPreviousPeriod) /
  //         totalInspectionsPreviousPeriod) *
  //       100;
  //     totalChange = `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
  //   } else if (totalInspectionsCurrentPeriod > 0) {
  //     totalChange = '+100%'; // If previous total was 0 and current is > 0
  //   }

  //   return {
  //     total: totalInspectionsCurrentPeriod,
  //     totalChange: totalChange,
  //     branchDistribution: branchDistribution,
  //   };
  // }

  // async getInspectorPerformance(
  //   query: GetDashboardStatsDto,
  // ): Promise<InspectorPerformanceResponseDto> {
  //   const { start_date, end_date, timezone } = query;
  //   const userTimezone = timezone || 'Asia/Jakarta';
  //   // Get all inspectors (users with role 'INSPECTOR')
  //   this.logger.log(`Date ${start_date} ${end_date}`);
  //   const inspectors = await this.prisma.user.findMany({
  //     where: {
  //       role: 'INSPECTOR',
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //     },
  //   });

  //   const performanceData: InspectorPerformanceItemDto[] = [];

  //   for (const inspector of inspectors) {
  //     if (!inspector.name) continue; // Skip if inspector name is null

  //     // Total inspections within the specified date range
  //     const whereClause: any = {
  //       // Tipe any untuk sederhana, idealnya gunakan tipe Prisma
  //       inspectorId: inspector.id,
  //     };

  //     if (start_date || end_date) {
  //       whereClause.createdAt = {};
  //       if (start_date) {
  //         whereClause.createdAt.gte = start_date;
  //       }
  //       if (end_date) {
  //         whereClause.createdAt.lte = end_date;
  //       }
  //     }

  //     const totalInspections = await this.prisma.inspection.count({
  //       where: whereClause,
  //     });

  //     performanceData.push({
  //       inspector: inspector.name,
  //       totalInspections,
  //     });
  //   }

  //   return { data: performanceData };
  // }
}
