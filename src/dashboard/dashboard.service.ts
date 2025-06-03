import { Injectable, BadRequestException } from '@nestjs/common';
import {
  GetDashboardStatsDto,
  TimePeriod,
} from './dto/get-dashboard-stats/get-dashboard-stats.dto';
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
import {
  GetOrderTrendDto,
  OrderTrendRangeType,
} from './dto/get-order-trend/get-order-trend.dto';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
  addHours,
  addDays,
  addMonths,
  format,
  isBefore,
  isAfter,
  isSameDay,
  isSameMonth,
  isSameYear,
  getYear,
  getMonth,
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

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper untuk mendapatkan rentang tanggal berdasarkan periode
  private getDateRange(
    period: TimePeriod | TargetPeriod,
    startDate?: string,
    endDate?: string,
    year?: number,
    month?: number, // 1-12
  ): { start?: Date; end?: Date } {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month !== undefined ? month - 1 : now.getMonth(); // Month is 0-indexed in Date object

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case TimePeriod.ALL_TIME: {
          start = undefined;
          end = undefined;
          break;
        }
        case TimePeriod.YEAR:
        case TargetPeriod.YEAR: {
          start = new Date(targetYear, 0, 1);
          end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
          break;
        }
        case TimePeriod.MONTH:
        case TargetPeriod.MONTH: {
          start = new Date(targetYear, targetMonth, 1);
          end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999); // Last day of month
          break;
        }
        case TimePeriod.WEEK:
        case TargetPeriod.WEEK: {
          // Calculate the first day of the week (Monday) for the given year/month/day
          const dateForWeek = new Date(targetYear, targetMonth, now.getDate()); // Start with a date in the target month/year
          const dayOfWeek = dateForWeek.getDay(); // 0 for Sunday, 1 for Monday, etc.
          const diff =
            dateForWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday of the current week

          start = new Date(dateForWeek.setDate(diff));
          start.setHours(0, 0, 0, 0); // Set to start of the day

          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999); // Set to end of the day
          break;
        }
        case TimePeriod.DAY:
        case TargetPeriod.DAY:
        default: {
          // If year and month are provided, calculate day based on that month/year
          // Otherwise, use current date
          const dateForDay = new Date(
            targetYear,
            targetMonth,
            now.getDate(), // Use current day of month if not specified
          );
          start = new Date(
            dateForDay.getFullYear(),
            dateForDay.getMonth(),
            dateForDay.getDate(),
          );
          end = new Date(
            dateForDay.getFullYear(),
            dateForDay.getMonth(),
            dateForDay.getDate(),
            23,
            59,
            59,
            999,
          );
          break;
        }
      }
    }
    return { start, end };
  }

  private calculatePercentage(current: number, target: number): string {
    if (target === 0) {
      return '0.00%';
    }
    const percentage = (current / target) * 100;
    return percentage.toFixed(2) + '%';
  }

  private async getInspectionReviewStatsForPeriod(
    start?: Date,
    end?: Date,
  ): Promise<InspectionStatsPeriodData> {
    const whereClause: Prisma.InspectionWhereInput = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    const total = await this.prisma.inspection.count({
      where: whereClause,
    });

    const approved = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.APPROVED },
    });

    const needReview = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.NEED_REVIEW },
    });

    const percentageReviewed = this.calculatePercentage(approved, total);

    return {
      total,
      approved,
      needReview,
      percentageReviewed,
    };
  }

  async setInspectionTarget(
    dto: SetInspectionTargetDto,
  ): Promise<InspectionTarget> {
    const { period, targetValue } = dto;
    const { start: targetDate } = this.getDateRange(period); // Get the start of the period as targetDate

    if (!targetDate) {
      throw new Error('Could not determine target date for the given period.');
    }

    // Ensure targetDate only contains date part for comparison with @db.Date
    targetDate.setHours(0, 0, 0, 0);

    return this.prisma.inspectionTarget.upsert({
      where: {
        period_targetDate: {
          period: period,
          targetDate: targetDate,
        },
      },
      update: {
        targetValue: targetValue,
      },
      create: {
        period: period,
        targetValue: targetValue,
        targetDate: targetDate,
      },
    });
  }

  async getInspectionTargetStats(): Promise<InspectionTargetStatsResponseDto> {
    const response: InspectionTargetStatsResponseDto = {};

    // All Time Stats
    const allTimeInspections = await this.prisma.inspection.count();
    response.allTime = {
      totalInspections: allTimeInspections,
      targetInspections: 0, // No target for all time
      percentageMet: this.calculatePercentage(allTimeInspections, 0), // Will be 0%
    };

    // This Year Stats
    const { start: yearStart, end: yearEnd } = this.getDateRange(
      TimePeriod.YEAR,
    );
    const thisYearInspections = await this.prisma.inspection.count({
      where: {
        createdAt: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
    });
    const thisYearTarget = await this.prisma.inspectionTarget.findUnique({
      where: {
        period_targetDate: {
          period: TargetPeriod.YEAR,
          targetDate: yearStart!, // Use the start of the year as the targetDate
        },
      },
    });
    response.thisYear = {
      totalInspections: thisYearInspections,
      targetInspections: thisYearTarget?.targetValue || 0,
      percentageMet: this.calculatePercentage(
        thisYearInspections,
        thisYearTarget?.targetValue || 0,
      ),
    };

    // This Month Stats
    const { start: monthStart, end: monthEnd } = this.getDateRange(
      TimePeriod.MONTH,
    );
    const thisMonthInspections = await this.prisma.inspection.count({
      where: {
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });
    const thisMonthTarget = await this.prisma.inspectionTarget.findUnique({
      where: {
        period_targetDate: {
          period: TargetPeriod.MONTH,
          targetDate: monthStart!, // Use the start of the month as the targetDate
        },
      },
    });
    response.thisMonth = {
      totalInspections: thisMonthInspections,
      targetInspections: thisMonthTarget?.targetValue || 0,
      percentageMet: this.calculatePercentage(
        thisMonthInspections,
        thisMonthTarget?.targetValue || 0,
      ),
    };

    // This Week Stats
    const { start: weekStart, end: weekEnd } = this.getDateRange(
      TimePeriod.WEEK,
    );
    const thisWeekInspections = await this.prisma.inspection.count({
      where: {
        createdAt: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });
    const thisWeekTarget = await this.prisma.inspectionTarget.findUnique({
      where: {
        period_targetDate: {
          period: TargetPeriod.WEEK,
          targetDate: weekStart!, // Use the start of the week as the targetDate
        },
      },
    });
    response.thisWeek = {
      totalInspections: thisWeekInspections,
      targetInspections: thisWeekTarget?.targetValue || 0,
      percentageMet: this.calculatePercentage(
        thisWeekInspections,
        thisWeekTarget?.targetValue || 0,
      ),
    };

    // Today Stats
    const { start: dayStart, end: dayEnd } = this.getDateRange(TimePeriod.DAY);
    const todayInspections = await this.prisma.inspection.count({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });
    const todayTarget = await this.prisma.inspectionTarget.findUnique({
      where: {
        period_targetDate: {
          period: TargetPeriod.DAY,
          targetDate: dayStart!, // Use the start of the day as the targetDate
        },
      },
    });
    response.today = {
      totalInspections: todayInspections,
      targetInspections: todayTarget?.targetValue || 0,
      percentageMet: this.calculatePercentage(
        todayInspections,
        todayTarget?.targetValue || 0,
      ),
    };

    return response;
  }

  async getInspectionReviewStats(): Promise<InspectionStatsResponseDto> {
    // All Time
    const allTimeStats = await this.getInspectionReviewStatsForPeriod(
      undefined,
      undefined,
    );

    // This Month
    const { start: monthStart, end: monthEnd } = this.getDateRange(
      TimePeriod.MONTH,
    );
    const thisMonthStats = await this.getInspectionReviewStatsForPeriod(
      monthStart,
      monthEnd,
    );

    // This Week
    const { start: weekStart, end: weekEnd } = this.getDateRange(
      TimePeriod.WEEK,
    );
    const thisWeekStats = await this.getInspectionReviewStatsForPeriod(
      weekStart,
      weekEnd,
    );

    // Today
    const { start: dayStart, end: dayEnd } = this.getDateRange(TimePeriod.DAY);
    const todayStats = await this.getInspectionReviewStatsForPeriod(
      dayStart,
      dayEnd,
    );

    return {
      allTime: allTimeStats,
      thisMonth: thisMonthStats,
      thisWeek: thisWeekStats,
      today: todayStats,
    };
  }

  async getMainOrderStatistics(query: GetDashboardStatsDto) {
    const { period, startDate, endDate, branch } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.ALL_TIME,
      startDate,
      endDate,
    );

    const whereClause: Prisma.InspectionWhereInput = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (branch) {
      whereClause.branchCity = {
        city: branch,
      };
    }

    const totalOrders = await this.prisma.inspection.count({
      where: whereClause,
    });

    const needReview = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.NEED_REVIEW },
    });

    const approved = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.APPROVED },
    });

    const archived = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.ARCHIVED },
    });

    const failArchive = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.FAIL_ARCHIVE },
    });

    const deactivated = await this.prisma.inspection.count({
      where: { ...whereClause, status: InspectionStatus.DEACTIVATED },
    });

    return {
      totalOrders,
      needReview,
      approved,
      archived,
      failArchive,
      deactivated,
    };
  }

  async getOrderTrend(query: GetOrderTrendDto): Promise<OrderTrendResponseDto> {
    const { range_type, start_date, end_date, timezone } = query;
    const userTimezone = timezone || 'Asia/Jakarta';

    const indonesianMonths = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Ags',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];

    let actualStartDateUsed: Date;
    let actualEndDateUsed: Date;
    const periods: OrderTrendItemDto[] = [];

    // Fungsi date-fns ini seharusnya diimpor dari 'date-fns' bukan 'date-fns-tz'
    // toZonedTime dan fromZonedTime adalah dari 'date-fns-tz'
    const nowInTimezone = toZonedTime(new Date(), userTimezone);

    const toUtcStartOfDay = (date: Date) =>
      fromZonedTime(startOfDay(date), userTimezone);
    const toUtcEndOfDay = (date: Date) =>
      fromZonedTime(endOfDay(date), userTimezone);

    // Logika untuk menentukan actualStartDateUsed, actualEndDateUsed, dan pra-inisialisasi 'periods'
    // Sebagian besar logika switch case Anda untuk ini sudah baik dan bisa dipertahankan.
    // Saya akan menyertakannya kembali untuk kelengkapan, dengan sedikit penyesuaian jika perlu.
    switch (range_type) {
      case OrderTrendRangeType.TODAY: {
        actualStartDateUsed = toUtcStartOfDay(nowInTimezone);
        actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        for (let i = 0; i < 24; i += 2) {
          const periodStartInTimezone = addHours(startOfDay(nowInTimezone), i);
          const periodEndInTimezone = addHours(periodStartInTimezone, 2);
          periods.push({
            period_label: `${format(periodStartInTimezone, 'HH:00')}-${format(periodEndInTimezone, 'HH:00')}`,
            period_start: fromZonedTime(periodStartInTimezone, userTimezone),
            period_end: fromZonedTime(periodEndInTimezone, userTimezone), // Sebenarnya period_end adalah eksklusif atau inklusif 23:59:59?
            count: 0,
          });
        }
        break;
      }
      case OrderTrendRangeType.LAST_7_DAYS: {
        actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        actualStartDateUsed = toUtcStartOfDay(subDays(nowInTimezone, 6));
        let currentDayInUTC = actualStartDateUsed;
        while (
          isBefore(currentDayInUTC, actualEndDateUsed) ||
          isSameDay(currentDayInUTC, actualEndDateUsed)
        ) {
          const dayInTimezone = toZonedTime(currentDayInUTC, userTimezone);
          periods.push({
            period_label: format(dayInTimezone, 'dd-MM-yyyy'),
            period_start: fromZonedTime(
              startOfDay(dayInTimezone),
              userTimezone,
            ),
            period_end: fromZonedTime(endOfDay(dayInTimezone), userTimezone),
            count: 0,
          });
          currentDayInUTC = addDays(currentDayInUTC, 1);
        }
        break;
      }
      case OrderTrendRangeType.LAST_30_DAYS: {
        actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        actualStartDateUsed = toUtcStartOfDay(subDays(nowInTimezone, 29));
        let currentDayInUTC = actualStartDateUsed;
        while (
          isBefore(currentDayInUTC, actualEndDateUsed) ||
          isSameDay(currentDayInUTC, actualEndDateUsed)
        ) {
          const dayInTimezone = toZonedTime(currentDayInUTC, userTimezone);
          periods.push({
            period_label: format(dayInTimezone, 'dd'),
            period_start: fromZonedTime(
              startOfDay(dayInTimezone),
              userTimezone,
            ),
            period_end: fromZonedTime(endOfDay(dayInTimezone), userTimezone),
            count: 0,
          });
          currentDayInUTC = addDays(currentDayInUTC, 1);
        }
        break;
      }
      case OrderTrendRangeType.MONTH_TO_DATE: {
        actualStartDateUsed = toUtcStartOfDay(startOfMonth(nowInTimezone));
        actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        let currentDayInUTC = actualStartDateUsed;
        while (
          isBefore(currentDayInUTC, actualEndDateUsed) ||
          isSameDay(currentDayInUTC, actualEndDateUsed)
        ) {
          const dayInTimezone = toZonedTime(currentDayInUTC, userTimezone);
          periods.push({
            period_label: format(dayInTimezone, 'dd'),
            period_start: fromZonedTime(
              startOfDay(dayInTimezone),
              userTimezone,
            ),
            period_end: fromZonedTime(endOfDay(dayInTimezone), userTimezone),
            count: 0,
          });
          currentDayInUTC = addDays(currentDayInUTC, 1);
        }
        break;
      }
      case OrderTrendRangeType.LAST_12_MONTHS:
      case OrderTrendRangeType.YEAR_TO_DATE:
      case OrderTrendRangeType.LAST_3_YEARS: {
        if (range_type === OrderTrendRangeType.LAST_12_MONTHS) {
          actualStartDateUsed = toUtcStartOfDay(
            subMonths(startOfMonth(nowInTimezone), 11),
          );
          actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        } else if (range_type === OrderTrendRangeType.YEAR_TO_DATE) {
          actualStartDateUsed = toUtcStartOfDay(startOfYear(nowInTimezone));
          actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        } else {
          // LAST_3_YEARS
          actualStartDateUsed = toUtcStartOfDay(
            subYears(startOfYear(nowInTimezone), 2),
          );
          actualEndDateUsed = toUtcEndOfDay(nowInTimezone);
        }

        let currentMonthStartInUTC = fromZonedTime(
          startOfMonth(toZonedTime(actualStartDateUsed, userTimezone)),
          userTimezone,
        );
        while (
          isBefore(currentMonthStartInUTC, actualEndDateUsed) ||
          isSameMonth(currentMonthStartInUTC, actualEndDateUsed)
        ) {
          const monthInTimezone = toZonedTime(
            currentMonthStartInUTC,
            userTimezone,
          );
          let periodEndUTC: Date;
          if (
            isSameMonth(monthInTimezone, nowInTimezone) &&
            isSameYear(monthInTimezone, nowInTimezone) &&
            (range_type !== OrderTrendRangeType.LAST_3_YEARS ||
              getYear(monthInTimezone) === getYear(nowInTimezone))
          ) {
            periodEndUTC = actualEndDateUsed; // Bulan saat ini, berakhir di actualEndDateUsed
          } else {
            periodEndUTC = fromZonedTime(
              endOfMonth(monthInTimezone),
              userTimezone,
            );
          }

          let label = indonesianMonths[getMonth(monthInTimezone)];
          if (range_type === OrderTrendRangeType.LAST_3_YEARS) {
            label = `${label} ${getYear(monthInTimezone)}`;
          }

          periods.push({
            period_label: label,
            period_start: currentMonthStartInUTC,
            period_end: periodEndUTC,
            count: 0,
          });
          currentMonthStartInUTC = addMonths(currentMonthStartInUTC, 1);
          if (getYear(currentMonthStartInUTC) > getYear(actualEndDateUsed) + 1)
            break; // Safety break
        }
        break;
      }
      case OrderTrendRangeType.CUSTOM: {
        if (!start_date || !end_date) {
          throw new BadRequestException(
            'start_date and end_date are required for custom range_type.',
          );
        }
        // Parsing tanggal dari string, asumsikan string adalah YYYY-MM-DD dan merepresentasikan waktu lokal pengguna
        const customStartInterpreted = new Date(start_date + 'T00:00:00'); // Interpretasi sebagai lokal
        const customEndInterpreted = new Date(end_date + 'T23:59:59'); // Interpretasi sebagai lokal

        const customStartInTimezone = toZonedTime(
          customStartInterpreted,
          userTimezone,
        );
        const customEndInTimezone = toZonedTime(
          customEndInterpreted,
          userTimezone,
        );

        if (isAfter(customStartInTimezone, customEndInTimezone)) {
          throw new BadRequestException('start_date cannot be after end_date.');
        }
        actualStartDateUsed = fromZonedTime(
          startOfDay(customStartInTimezone),
          userTimezone,
        );
        actualEndDateUsed = fromZonedTime(
          endOfDay(customEndInTimezone),
          userTimezone,
        );

        let currentDayInUTC = actualStartDateUsed;
        while (
          isBefore(currentDayInUTC, actualEndDateUsed) ||
          isSameDay(currentDayInUTC, actualEndDateUsed)
        ) {
          const dayInTimezone = toZonedTime(currentDayInUTC, userTimezone);
          periods.push({
            period_label: format(dayInTimezone, 'dd'),
            period_start: fromZonedTime(
              startOfDay(dayInTimezone),
              userTimezone,
            ),
            period_end: fromZonedTime(endOfDay(dayInTimezone), userTimezone),
            count: 0,
          });
          currentDayInUTC = addDays(currentDayInUTC, 1);
        }
        break;
      }
      default:
        throw new BadRequestException(`Unsupported range_type: ${range_type}`);
    }

    // --- BAGIAN BARU: Fetch dan proses data agregat dari database ---
    let aggregatedResults: any[] = [];

    if (range_type === OrderTrendRangeType.TODAY) {
      aggregatedResults = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            FLOOR(EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${userTimezone}) / 2) AS slot_index,
            COUNT(*)::integer AS count
          FROM "inspections"
          WHERE "createdAt" >= ${actualStartDateUsed} AND "createdAt" <= ${actualEndDateUsed}
          GROUP BY slot_index
          ORDER BY slot_index ASC;
        `,
      );
    } else if (
      range_type === OrderTrendRangeType.LAST_7_DAYS ||
      range_type === OrderTrendRangeType.LAST_30_DAYS ||
      range_type === OrderTrendRangeType.MONTH_TO_DATE ||
      range_type === OrderTrendRangeType.CUSTOM
    ) {
      aggregatedResults = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            DATE_TRUNC('day', "createdAt" AT TIME ZONE ${userTimezone}) AS period_group,
            COUNT(*)::integer AS count
          FROM "inspections"
          WHERE "createdAt" >= ${actualStartDateUsed} AND "createdAt" <= ${actualEndDateUsed}
          GROUP BY period_group
          ORDER BY period_group ASC;
        `,
      );
    } else if (
      range_type === OrderTrendRangeType.LAST_12_MONTHS ||
      range_type === OrderTrendRangeType.YEAR_TO_DATE ||
      range_type === OrderTrendRangeType.LAST_3_YEARS
    ) {
      aggregatedResults = await this.prisma.$queryRaw(
        Prisma.sql`
          SELECT
            DATE_TRUNC('month', "createdAt" AT TIME ZONE ${userTimezone}) AS period_group,
            COUNT(*)::integer AS count
          FROM "inspections"
          WHERE "createdAt" >= ${actualStartDateUsed} AND "createdAt" <= ${actualEndDateUsed}
          GROUP BY period_group
          ORDER BY period_group ASC;
        `,
      );
    }

    const trendDataMap = new Map<string, number>();

    // Inisialisasi map dengan semua periode dari 'periods' array (untuk gap filling)
    for (const period of periods) {
      let key: string;
      const periodStartTimezone = toZonedTime(
        period.period_start,
        userTimezone,
      );
      if (range_type === OrderTrendRangeType.TODAY) {
        key = period.period_label; // "HH:00-HH:00"
      } else if (range_type === OrderTrendRangeType.LAST_7_DAYS) {
        key = format(periodStartTimezone, 'dd-MM-yyyy');
      } else if (
        range_type === OrderTrendRangeType.LAST_30_DAYS ||
        range_type === OrderTrendRangeType.MONTH_TO_DATE ||
        range_type === OrderTrendRangeType.CUSTOM
      ) {
        // Kunci untuk harian adalah tanggalnya agar unik jika rentang melewati bulan
        key = format(periodStartTimezone, 'yyyy-MM-dd');
      } else {
        // Monthly
        key = `${getYear(periodStartTimezone)}-${getMonth(periodStartTimezone)}`; // YYYY-M (0-indexed month)
      }
      trendDataMap.set(key, 0);
    }

    // Isi map dengan data dari hasil query agregat
    for (const result of aggregatedResults) {
      let key: string;
      if (range_type === OrderTrendRangeType.TODAY) {
        const slotIndex = result.slot_index as number;
        const hourStart = slotIndex * 2;
        key = `${String(hourStart).padStart(2, '0')}:00-${String(hourStart + 2).padStart(2, '0')}:00`;
        if (hourStart + 2 === 24) {
          // Handle 22:00-24:00 case
          key = `${String(hourStart).padStart(2, '0')}:00-00:00`;
          // Special check for 22:00-00:00, if periods label is 22:00-24:00
          const twentyFourKey = `${String(hourStart).padStart(2, '0')}:00-24:00`;
          if (periods.find((p) => p.period_label === twentyFourKey))
            key = twentyFourKey;
        }
      } else if (range_type === OrderTrendRangeType.LAST_7_DAYS) {
        const periodGroupDate = toZonedTime(
          new Date(result.period_group),
          userTimezone,
        );
        key = format(periodGroupDate, 'dd-MM-yyyy');
      } else if (
        range_type === OrderTrendRangeType.LAST_30_DAYS ||
        range_type === OrderTrendRangeType.MONTH_TO_DATE ||
        range_type === OrderTrendRangeType.CUSTOM
      ) {
        // 'period_group' dari SQL adalah timestamp (Date object di JS) yang sudah di-truncate dan di-timezone
        // Kita perlu format ke YYYY-MM-DD untuk konsistensi kunci harian
        const periodGroupDate = toZonedTime(
          new Date(result.period_group),
          userTimezone,
        );
        key = format(periodGroupDate, 'yyyy-MM-dd');
      } else {
        // Monthly
        const periodGroupDate = toZonedTime(
          new Date(result.period_group),
          userTimezone,
        );
        key = `${getYear(periodGroupDate)}-${getMonth(periodGroupDate)}`; // YYYY-M (0-indexed month)
      }
      trendDataMap.set(key, result.count as number);
    }

    // Map counts kembali ke array 'periods'
    const finalData: OrderTrendItemDto[] = periods.map((period) => {
      let key: string;
      const periodStartTimezone = toZonedTime(
        period.period_start,
        userTimezone,
      );
      if (range_type === OrderTrendRangeType.TODAY) {
        key = period.period_label;
      } else if (range_type === OrderTrendRangeType.LAST_7_DAYS) {
        key = format(periodStartTimezone, 'dd-MM-yyyy');
      } else if (
        range_type === OrderTrendRangeType.LAST_30_DAYS ||
        range_type === OrderTrendRangeType.MONTH_TO_DATE ||
        range_type === OrderTrendRangeType.CUSTOM
      ) {
        key = format(periodStartTimezone, 'yyyy-MM-dd'); // Cocokkan dengan kunci yang digunakan saat mengisi dari DB
      } else {
        // Monthly
        key = `${getYear(periodStartTimezone)}-${getMonth(periodStartTimezone)}`;
      }
      return {
        ...period,
        count: trendDataMap.get(key) || 0, // Ambil count dari map, default 0 jika tidak ada
      };
    });

    // Urutkan finalData (sebenarnya sudah terurut dari pembuatan 'periods' jika dilakukan dengan benar)
    finalData.sort(
      (a, b) => a.period_start.getTime() - b.period_start.getTime(),
    );

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

  async getBranchDistribution(
    query: GetDashboardStatsDto,
  ): Promise<BranchDistributionResponse> {
    const { period, startDate, endDate } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.ALL_TIME,
      startDate,
      endDate,
    );

    // Get all unique branch cities
    const branchCities = await this.prisma.inspectionBranchCity.findMany({
      select: {
        city: true,
      },
    });

    const branchDistribution: BranchDistributionItem[] = [];
    let totalInspectionsCurrentPeriod = 0;

    // Calculate total inspections for the current period first
    const totalInspectionsResult = await this.prisma.inspection.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
    totalInspectionsCurrentPeriod = totalInspectionsResult._count.id;

    for (const branchCity of branchCities) {
      const currentPeriodCount = await this.prisma.inspection.count({
        where: {
          branchCity: {
            city: branchCity.city,
          },
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      });

      // Calculate percentage for current period
      const percentage =
        totalInspectionsCurrentPeriod > 0
          ? (
              (currentPeriodCount / totalInspectionsCurrentPeriod) *
              100
            ).toFixed(1) + '%'
          : '0.0%';

      // Calculate previous period's range
      const { start: prevStart, end: prevEnd } = this.getPreviousDateRange(
        period ?? TimePeriod.ALL_TIME,
        start,
        end,
      );

      let previousPeriodCount = 0;
      if (prevStart || prevEnd) {
        // Only query if previous period is defined
        previousPeriodCount = await this.prisma.inspection.count({
          where: {
            branchCity: {
              city: branchCity.city,
            },
            createdAt: {
              gte: prevStart,
              lte: prevEnd,
            },
          },
        });
      }

      // Calculate change percentage
      let change = '0%';
      if (previousPeriodCount > 0) {
        const changeValue =
          ((currentPeriodCount - previousPeriodCount) / previousPeriodCount) *
          100;
        change = `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
      } else if (currentPeriodCount > 0) {
        change = '+100%'; // If previous was 0 and current is > 0
      }

      branchDistribution.push({
        branch: branchCity.city,
        count: currentPeriodCount,
        percentage: percentage,
        change: change,
      });
    }

    // Handle 'Others' if there are inspections not tied to a specific branch city or if some branches are not listed
    // For simplicity, let's assume all inspections are tied to a branch city for now.
    // If there's a need for 'Others', it would involve querying inspections without a branchCityId.

    // Calculate total inspections for the previous period
    const { start: prevTotalStart, end: prevTotalEnd } =
      this.getPreviousDateRange(period ?? TimePeriod.ALL_TIME, start, end);

    let totalInspectionsPreviousPeriod = 0;
    if (prevTotalStart || prevTotalEnd) {
      const totalPrevInspectionsResult = await this.prisma.inspection.aggregate(
        {
          _count: {
            id: true,
          },
          where: {
            createdAt: {
              gte: prevTotalStart,
              lte: prevTotalEnd,
            },
          },
        },
      );
      totalInspectionsPreviousPeriod = totalPrevInspectionsResult._count.id;
    }

    // Calculate overall change percentage
    let totalChange = '0%';
    if (totalInspectionsPreviousPeriod > 0) {
      const changeValue =
        ((totalInspectionsCurrentPeriod - totalInspectionsPreviousPeriod) /
          totalInspectionsPreviousPeriod) *
        100;
      totalChange = `${changeValue > 0 ? '+' : ''}${changeValue.toFixed(1)}%`;
    } else if (totalInspectionsCurrentPeriod > 0) {
      totalChange = '+100%'; // If previous total was 0 and current is > 0
    }

    return {
      total: totalInspectionsCurrentPeriod,
      totalChange: totalChange,
      branchDistribution: branchDistribution,
    };
  }

  // Helper to get the previous date range
  private getPreviousDateRange(
    period: TimePeriod,
    currentStart?: Date,
    currentEnd?: Date,
  ): { start?: Date; end?: Date } {
    if (!currentStart || !currentEnd) {
      // For ALL_TIME or if current range is not defined, previous range is also undefined
      return { start: undefined, end: undefined };
    }

    let prevStart: Date;
    let prevEnd: Date;

    switch (period) {
      case TimePeriod.YEAR:
        prevStart = new Date(currentStart.getFullYear() - 1, 0, 1);
        prevEnd = new Date(currentEnd.getFullYear() - 1, 11, 31);
        break;
      case TimePeriod.MONTH:
        prevStart = new Date(
          currentStart.getFullYear(),
          currentStart.getMonth() - 1,
          1,
        );
        prevEnd = new Date(
          currentStart.getFullYear(),
          currentStart.getMonth(),
          0,
        );
        break;
      case TimePeriod.WEEK:
        prevStart = new Date(currentStart.setDate(currentStart.getDate() - 7));
        prevEnd = new Date(currentEnd.setDate(currentEnd.getDate() - 7));
        break;
      case TimePeriod.DAY:
        prevStart = new Date(currentStart.setDate(currentStart.getDate() - 1));
        prevEnd = new Date(currentEnd.setDate(currentEnd.getDate() - 1));
        break;
      case TimePeriod.ALL_TIME:
      default:
        return { start: undefined, end: undefined };
    }
    return { start: prevStart, end: prevEnd };
  }

  async getInspectorPerformance(): Promise<InspectorPerformanceResponseDto> {
    // Get date ranges for current month, week, and day based on current date
    const { start: monthStart, end: monthEnd } = this.getDateRange(
      TimePeriod.MONTH,
    );
    const { start: weekStart, end: weekEnd } = this.getDateRange(
      TimePeriod.WEEK,
    );
    const { start: dayStart, end: dayEnd } = this.getDateRange(TimePeriod.DAY);

    // Get all inspectors (users with role 'INSPECTOR')
    const inspectors = await this.prisma.user.findMany({
      where: {
        role: 'INSPECTOR',
      },
      select: {
        id: true,
        name: true,
      },
    });

    const performanceData: InspectorPerformanceItemDto[] = [];

    for (const inspector of inspectors) {
      if (!inspector.name) continue; // Skip if inspector name is null

      // Total inspections for all time
      const totalInspections = await this.prisma.inspection.count({
        where: {
          inspectorId: inspector.id,
        },
      });

      // Monthly inspections
      const monthlyInspections = await this.prisma.inspection.count({
        where: {
          inspectorId: inspector.id,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      // Weekly inspections
      const weeklyInspections = await this.prisma.inspection.count({
        where: {
          inspectorId: inspector.id,
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      // Daily inspections
      const dailyInspections = await this.prisma.inspection.count({
        where: {
          inspectorId: inspector.id,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      performanceData.push({
        inspector: inspector.name,
        totalInspections,
        monthlyInspections,
        weeklyInspections,
        dailyInspections,
      });
    }

    return { data: performanceData };
  }
}
