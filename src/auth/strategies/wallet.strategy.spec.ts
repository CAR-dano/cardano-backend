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

/** Creates a mock Express request with the given body */
const createMockRequest = (body: any) => ({ body }) as any;

/** Valid CIP-0030 DataSignature object */
const validSignatureObj = { signature: 'cbor-sig-hex', key: 'cbor-key-hex' };

/** Valid request body matching LoginWalletDto */
const validBody = {
  walletAddress: 'addr1qx2k8testwalletaddress',
  payload: 'Login to CAR-dano: addr1qx2k8testwalletaddress at 2026-03-14T10:00:00.000Z',
  signature: JSON.stringify(validSignatureObj),
};

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
    it('should return user when wallet signature is valid', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(req);

      expect(mockAuthService.validateWalletUser).toHaveBeenCalledWith(
        validBody.walletAddress,
        validBody.payload,
        validSignatureObj,
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when walletAddress is missing', async () => {
      const req = createMockRequest({
        payload: validBody.payload,
        signature: validBody.signature,
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payload is missing', async () => {
      const req = createMockRequest({
        walletAddress: validBody.walletAddress,
        signature: validBody.signature,
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when signature is missing', async () => {
      const req = createMockRequest({
        walletAddress: validBody.walletAddress,
        payload: validBody.payload,
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when all fields are missing', async () => {
      const req = createMockRequest({});

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when signature is not valid JSON', async () => {
      const req = createMockRequest({
        ...validBody,
        signature: 'not-valid-json',
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when signature JSON is missing key field', async () => {
      const req = createMockRequest({
        ...validBody,
        signature: JSON.stringify({ signature: 'sig-only' }), // missing 'key'
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when signature JSON is missing signature field', async () => {
      const req = createMockRequest({
        ...validBody,
        signature: JSON.stringify({ key: 'key-only' }), // missing 'signature'
      });

      await expect(strategy.validate(req)).rejects.toThrow(BadRequestException);
      expect(mockAuthService.validateWalletUser).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when validateWalletUser returns null', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockResolvedValue(null);

      await expect(strategy.validate(req)).rejects.toThrow(UnauthorizedException);
    });

    it('should propagate UnauthorizedException thrown by validateWalletUser', async () => {
      const req = createMockRequest(validBody);
      mockAuthService.validateWalletUser.mockRejectedValue(
        new UnauthorizedException('Invalid signature'),
      );

      await expect(strategy.validate(req)).rejects.toThrow(UnauthorizedException);
    });
  });
});
