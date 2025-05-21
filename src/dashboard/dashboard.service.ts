import { Injectable } from '@nestjs/common';
import {
  GetDashboardStatsDto,
  TimePeriod,
} from './dto/get-dashboard-stats/get-dashboard-stats.dto';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionStatus, Prisma } from '@prisma/client'; // Assuming InspectionStatus is a Prisma enum

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper untuk mendapatkan rentang tanggal berdasarkan periode
  private getDateRange(
    period: TimePeriod,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
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
      period ?? TimePeriod.DAY,
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

  async getOrderTrend(query: GetDashboardStatsDto) {
    const { period, startDate, endDate, branch } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.DAY,
      startDate,
      endDate,
    );

    // Lakukan query ke database untuk mendapatkan jumlah pesanan per periode waktu
    // Contoh: SELECT DATE_TRUNC(period, createdAt), COUNT(*) FROM inspections WHERE ... GROUP BY ...
    return [
      { date: '2023-01', count: 120 },
      { date: '2023-02', count: 150 },
      { date: '2023-03', count: 130 },
      // ...
    ];
  }

  async getBranchDistribution(query: GetDashboardStatsDto) {
    const { period, startDate, endDate } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.DAY,
      startDate,
      endDate,
    );

    // Lakukan query untuk distribusi per cabang
    return [
      { branch: 'Yogyakarta', count: 500, percentage: '33.3%', change: '+5%' },
      { branch: 'Semarang', count: 400, percentage: '26.7%', change: '-2%' },
      { branch: 'Solo', count: 300, percentage: '20.0%', change: '+10%' },
      { branch: 'Others', count: 300, percentage: '20.0%', change: '0%' },
    ];
  }

  async getInspectorPerformance(query: GetDashboardStatsDto) {
    const { period, startDate, endDate } = query;
    const { start, end } = this.getDateRange(
      period ?? TimePeriod.DAY,
      startDate,
      endDate,
    );

    // Query untuk kinerja inspektur
    return [
      { inspector: 'Budi Santoso', inspections: 80 },
      { inspector: 'Ani Rahayu', inspections: 75 },
      { inspector: 'Candra Wijaya', inspections: 60 },
    ];
  }

  async getOverallValueDistribution() {
    // Query untuk pengelompokan berdasarkan rentang nilai
    return [
      { range: '< 50 Juta', count: 200 },
      { range: '50 - 100 Juta', count: 500 },
      { range: '> 100 Juta', count: 300 },
    ];
  }

  async getCarBrandDistribution() {
    // Query untuk distribusi berdasarkan merek mobil
    return [
      { brand: 'Toyota', count: 400 },
      { brand: 'Honda', count: 350 },
      { brand: 'Mitsubishi', count: 200 },
      { brand: 'Suzuki', count: 150 },
    ];
  }

  async getProductionYearDistribution() {
    // Query untuk distribusi berdasarkan tahun produksi mobil
    return [
      { year: 2020, count: 250 },
      { year: 2021, count: 300 },
      { year: 2022, count: 400 },
      { year: 2023, count: 350 },
    ];
  }

  async getTransmissionTypeDistribution() {
    // Query untuk distribusi berdasarkan jenis transmisi mobil
    return [
      { type: 'Manual', count: 600 },
      { type: 'Otomatis', count: 900 },
    ];
  }

  async getBlockchainStatus() {
    // Query untuk jumlah pesanan yang sudah diunggah/minted ke blockchain
    return {
      mintedToBlockchain: 800,
      pendingMint: 50,
      failedMint: 10,
    };
  }
}
