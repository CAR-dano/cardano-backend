/*
 * --------------------------------------------------------------------------
 * File: wallet.strategy.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the WalletStrategy.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { WalletStrategy } from './wallet.strategy';
import { AuthService } from '../auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

const mockAuthService = {
  validateWalletUser: jest.fn(),
};

const mockUser = {
  id: 'user-456',
  email: null,
  username: null,
  name: 'Wallet User',
  role: Role.CUSTOMER,
  walletAddress: 'addr1qx2k8testwalletaddress',
  isActive: true,
  whatsappNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockRequest = (body: any) => ({ body }) as any;

describe('WalletStrategy', () => {
  let strategy: WalletStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletStrategy,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<WalletStrategy>(WalletStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    const validBody = {
      walletAddress: 'addr1qx2k8testwalletaddress',
      signatureData: { key: 'signature-hex', signature: 'sig-hex' },
    };

    it('should return user when wallet signature is valid', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(req);

      expect(mockAuthService.validateWalletUser).toHaveBeenCalledWith(
        validBody.walletAddress,
        validBody.signatureData,
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when walletAddress is missing', async () => {
      const req = createMockRequest({ signatureData: { key: 'sig' } });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when signatureData is missing', async () => {
      const req = createMockRequest({ walletAddress: 'addr1test' });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when both walletAddress and signatureData are missing', async () => {
      const req = createMockRequest({});

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when validateWalletUser returns null', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockResolvedValue(null);

      await expect(strategy.validate(req)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when validateWalletUser throws', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockRejectedValue(
        new UnauthorizedException('Invalid signature'),
      );

      await expect(strategy.validate(req)).rejects.toThrow(UnauthorizedException);
    });
  });
});
