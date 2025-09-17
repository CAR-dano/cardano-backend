import { Test, TestingModule } from '@nestjs/testing';
import { CustomerReportsController } from './customer-reports.controller';
import { CustomerReportsService } from './customer-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { Role } from '@prisma/client';
import { Response } from 'express';

const mockCustomerReportsService = {
  listPurchasedReports: jest.fn(),
  getReportDetail: jest.fn(),
  streamNoDocs: jest.fn(),
};

const createUserDto = (): UserResponseDto =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    username: 'user',
    name: 'User',
    walletAddress: null,
    role: Role.CUSTOMER,
    whatsappNumber: null,
    profilePhotoUrl: null,
    googleAvatarUrl: null,
    isGoogleLinked: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    inspectionBranchCity: null,
  } as unknown as UserResponseDto);

describe('CustomerReportsController', () => {
  let controller: CustomerReportsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerReportsController],
      providers: [
        { provide: CustomerReportsService, useValue: mockCustomerReportsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(CustomerReportsController);
  });

  describe('listPurchasedReports', () => {
    it('should return list response from service', async () => {
      const user = createUserDto();
      const query = { page: 1 } as any;
      const serviceResult = {
        items: [{ id: 'consumption-1' }],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      } as any;
      mockCustomerReportsService.listPurchasedReports.mockResolvedValue(
        serviceResult,
      );

      const result = await controller.listPurchasedReports(user, query);

      expect(mockCustomerReportsService.listPurchasedReports).toHaveBeenCalledWith(
        user.id,
        query,
      );
      expect(result.items).toEqual(serviceResult.items);
      expect(result.meta).toEqual(serviceResult.meta);
    });
  });

  describe('getReportDetail', () => {
    it('should return detail from service', async () => {
      const user = createUserDto();
      const detail = { inspection: { id: 'inspection-1' } } as any;
      mockCustomerReportsService.getReportDetail.mockResolvedValue(detail);

      const result = await controller.getReportDetail(user, 'inspection-1');

      expect(mockCustomerReportsService.getReportDetail).toHaveBeenCalledWith(
        user.id,
        'inspection-1',
      );
      expect(result).toBe(detail);
    });
  });

  describe('downloadNoDocs', () => {
    it('should delegate to service for streaming', async () => {
      const user = createUserDto();
      const res = {
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.downloadNoDocs(user, 'inspection-1', res);

      expect(mockCustomerReportsService.streamNoDocs).toHaveBeenCalledWith(
        user.id,
        'inspection-1',
        res,
      );
    });
  });
});
