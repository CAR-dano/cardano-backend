/*
 * --------------------------------------------------------------------------
 * File: jwt-refresh.strategy.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the JwtRefreshStrategy.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { VaultConfigService } from '../../config/vault-config.service';

jest.mock('bcrypt');

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-refresh-secret'),
  getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
};

/** Minimal VaultConfigService mock — no Vault server needed in unit tests. */
const mockVaultConfigService: Partial<VaultConfigService> = {
  getSecrets: jest.fn().mockResolvedValue({}),
  get: jest.fn().mockResolvedValue(''),
  isVaultAvailable: jest.fn().mockReturnValue(false),
  invalidateCache: jest.fn(),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
};

const mockUsersService = {
  findById: jest.fn(),
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: Role.ADMIN,
  isActive: true,
  refreshToken: 'hashed-refresh-token',
  walletAddress: null,
  whatsappNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPayload = {
  sub: 'user-123',
  email: 'test@example.com',
  role: Role.ADMIN,
  sessionVersion: 1,
};

const createMockRequest = (authHeader?: string) =>
  ({
    get: jest.fn().mockReturnValue(authHeader),
  }) as any;

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: VaultConfigService, useValue: mockVaultConfigService },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when refresh token matches', async () => {
      const req = createMockRequest('Bearer valid-refresh-token');
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await strategy.validate(req, mockPayload);

      expect(mockUsersService.findById).toHaveBeenCalledWith('user-123');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'valid-refresh-token',
        'hashed-refresh-token',
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when no refresh token in request', async () => {
      const req = createMockRequest(undefined);

      await expect(strategy.validate(req, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const req = createMockRequest('Bearer valid-token');
      mockUsersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(req, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no stored refresh token', async () => {
      const req = createMockRequest('Bearer valid-token');
      mockUsersService.findById.mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      await expect(strategy.validate(req, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when refresh token does not match', async () => {
      const req = createMockRequest('Bearer wrong-token');
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(strategy.validate(req, mockPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
