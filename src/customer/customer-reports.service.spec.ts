import { Test, TestingModule } from '@nestjs/testing';
import { CustomerReportsService } from './customer-reports.service';
import { ReportsService } from '../reports/reports.service';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../logging/app-logger.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { InspectionStatus, Role } from '@prisma/client';
import { Response } from 'express';

const mockReportsService = {
  listDownloadsWithMeta: jest.fn(),
  getDetail: jest.fn(),
  streamNoDocsPdf: jest.fn(),
};

const mockCreditsService = {
  hasConsumption: jest.fn(),
};

const mockPrismaService = {
  inspection: {
    findUnique: jest.fn(),
  },
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockAuditLogger = {
  log: jest.fn(),
};

describe('CustomerReportsService', () => {
  let service: CustomerReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerReportsService,
        { provide: ReportsService, useValue: mockReportsService },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppLogger, useValue: mockLogger },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get(CustomerReportsService);
  });

  describe('listPurchasedReports', () => {
    it('should delegate to ReportsService and log audit entry', async () => {
      const resultMock = {
        data: [{ id: 'consumption-1' }],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      } as any;
      mockReportsService.listDownloadsWithMeta.mockResolvedValue(resultMock);

      const result = await service.listPurchasedReports('user-1', { page: 1 });

      expect(mockReportsService.listDownloadsWithMeta).toHaveBeenCalledWith(
        'user-1',
        { page: 1 },
      );
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-1',
          action: 'REPORT_HISTORY_VIEW',
        }),
      );
      expect(result).toEqual({
        items: resultMock.data,
        meta: resultMock.meta,
      });
    });
  });

  describe('getReportDetail', () => {
    const userId = 'user-1';
    const inspectionId = 'inspection-1';

    it('should return detail when ownership validated', async () => {
      mockCreditsService.hasConsumption.mockResolvedValue(true);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: InspectionStatus.ARCHIVED,
      });
      mockReportsService.getDetail.mockResolvedValue({
        inspection: { id: inspectionId },
      });

      const detail = await service.getReportDetail(userId, inspectionId);

      expect(mockCreditsService.hasConsumption).toHaveBeenCalledWith(
        userId,
        inspectionId,
      );
      expect(mockReportsService.getDetail).toHaveBeenCalledWith(
        inspectionId,
        userId,
        Role.CUSTOMER,
      );
      expect(detail).toEqual({ inspection: { id: inspectionId } });
    });

    it('should throw NotFound if report not purchased', async () => {
      mockCreditsService.hasConsumption.mockResolvedValue(false);

      await expect(
        service.getReportDetail(userId, inspectionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw Forbidden when inspection not archived', async () => {
      mockCreditsService.hasConsumption.mockResolvedValue(true);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: InspectionStatus.APPROVED,
      });

      await expect(
        service.getReportDetail(userId, inspectionId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('streamNoDocs', () => {
    const userId = 'user-1';
    const inspectionId = 'inspection-1';
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;

    it('should delegate streaming after ownership check', async () => {
      mockCreditsService.hasConsumption.mockResolvedValue(true);
      mockPrismaService.inspection.findUnique.mockResolvedValue({
        status: InspectionStatus.ARCHIVED,
      });

      await service.streamNoDocs(userId, inspectionId, res);

      expect(mockReportsService.streamNoDocsPdf).toHaveBeenCalledWith(
        inspectionId,
        userId,
        Role.CUSTOMER,
        res,
      );
    });

    it('should throw NotFound when ownership missing', async () => {
      mockCreditsService.hasConsumption.mockResolvedValue(false);

      await expect(
        service.streamNoDocs(userId, inspectionId, res),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
