import { Injectable } from '@nestjs/common';
import {
  GetDashboardStatsDto,
  TimePeriod,
} from './dto/get-dashboard-stats/get-dashboard-stats.dto';
import {
  InspectorPerformanceItemDto,
  InspectorPerformanceResponseDto,
} from './dto/inspector-performance-response.dto';
import {
  CarBrandDistributionItemDto,
  CarBrandDistributionResponseDto,
} from './dto/car-brand-distribution-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionStatus, Prisma } from '@prisma/client'; // Assuming InspectionStatus is a Prisma enum

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
    period: TimePeriod,
    startDate?: string,
    endDate?: string,
  ): { start?: Date; end?: Date } {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case TimePeriod.ALL_TIME:
          start = undefined; // No start date for all time
          end = undefined; // No end date for all time
          break;
        case TimePeriod.YEAR:
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31);
          break;
        case TimePeriod.MONTH:
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
          break;
        case TimePeriod.WEEK:
          // Adjust to Sunday of the current week (or Monday depending on locale)
          start = new Date(now.setDate(now.getDate() - now.getDay()));
          end = new Date(now.setDate(now.getDate() + 6));
          break;
        case TimePeriod.DAY:
        default:
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
          );
          break;
      }
    }
    return { start, end };
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

  getOrderTrend(query: GetDashboardStatsDto) {
    const { period, startDate, endDate } = query;
    this.getDateRange(period ?? TimePeriod.DAY, startDate, endDate);

    // Lakukan query ke database untuk mendapatkan jumlah pesanan per periode waktu
    // Contoh: SELECT DATE_TRUNC(period, createdAt), COUNT(*) FROM inspections WHERE ... GROUP BY ...
    return [
      { date: '2023-01', count: 120 },
      { date: '2023-02', count: 150 },
      { date: '2023-03', count: 130 },
      // ...
    ];
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

  getOverallValueDistribution() {
    // Query untuk pengelompokan berdasarkan rentang nilai
    return [
      { range: '< 50 Juta', count: 200 },
      { range: '50 - 100 Juta', count: 500 },
      { range: '> 100 Juta', count: 300 },
    ];
  }

  async getCarBrandDistribution(
    query: GetDashboardStatsDto,
  ): Promise<CarBrandDistributionResponseDto> {
    const { period, startDate, endDate } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.ALL_TIME,
      startDate,
      endDate,
    );

    const inspections = await this.prisma.inspection.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        vehicleData: {
          // Ensure vehicleData is not null and contains a 'brand' key
          // This is a basic check, more robust validation might be needed depending on data consistency
          not: Prisma.JsonNull,
        },
      },
      select: {
        vehicleData: true,
      },
    });

    const brandCounts = new Map<string, number>();

    for (const inspection of inspections) {
      if (inspection.vehicleData) {
        // Assuming vehicleData is a JSON object with a 'brand' property
        const vehicleData = inspection.vehicleData as Prisma.JsonObject;
        const brand = vehicleData['merekKendaraan'];

        if (typeof brand === 'string' && brand.trim() !== '') {
          const normalizedBrand = brand.trim();
          brandCounts.set(
            normalizedBrand,
            (brandCounts.get(normalizedBrand) || 0) + 1,
          );
        }
      }
    }

    const data: CarBrandDistributionItemDto[] = Array.from(
      brandCounts.entries(),
    ).map(([brand, count]) => ({
      brand,
      count,
    }));

    // Sort by count in descending order
    data.sort((a, b) => b.count - a.count);

    return { data };
  }

  async getProductionYearDistribution(query: GetDashboardStatsDto) {
    const { period, startDate, endDate } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.ALL_TIME,
      startDate,
      endDate,
    );

    const inspections = await this.prisma.inspection.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        vehicleData: {
          not: Prisma.JsonNull,
        },
      },
      select: {
        vehicleData: true,
      },
    });

    const yearCounts = new Map<number, number>();

    for (const inspection of inspections) {
      if (inspection.vehicleData) {
        const vehicleData = inspection.vehicleData as Prisma.JsonObject;
        const productionYear = vehicleData['tahun'];

        if (typeof productionYear === 'number') {
          yearCounts.set(
            productionYear,
            (yearCounts.get(productionYear) || 0) + 1,
          );
        }
      }
    }

    const data = Array.from(yearCounts.entries()).map(([year, count]) => ({
      year,
      count,
    }));

    // Sort by year in ascending order
    data.sort((a, b) => a.year - b.year);

    return { data };
  }

  getTransmissionTypeDistribution() {
    // Query untuk distribusi berdasarkan jenis transmisi mobil
    return [
      { type: 'Manual', count: 600 },
      { type: 'Otomatis', count: 900 },
    ];
  }

  getBlockchainStatus() {
    // Query untuk jumlah pesanan yang sudah diunggah/minted ke blockchain
    return {
      mintedToBlockchain: 800,
      pendingMint: 50,
      failedMint: 10,
    };
  }
}
