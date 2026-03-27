/*
 * --------------------------------------------------------------------------
 * File: local.strategy.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the LocalStrategy.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';

const mockAuthService = {
  validateLocalUser: jest.fn(),
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: Role.ADMIN,
  isActive: true,
  walletAddress: null,
  whatsappNumber: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      mockAuthService.validateLocalUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('testuser', 'password123');

      expect(mockAuthService.validateLocalUser).toHaveBeenCalledWith(
        'testuser',
        'password123',
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when validateLocalUser returns null', async () => {
      mockAuthService.validateLocalUser.mockResolvedValue(null);

      await expect(
        strategy.validate('invalid@test.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when authService throws', async () => {
      mockAuthService.validateLocalUser.mockRejectedValue(
        new UnauthorizedException('Invalid'),
      );

      await expect(strategy.validate('test@test.com', 'pass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should pass email as loginIdentifier correctly', async () => {
      mockAuthService.validateLocalUser.mockResolvedValue(mockUser);

      await strategy.validate('email@test.com', 'mypassword');

      expect(mockAuthService.validateLocalUser).toHaveBeenCalledWith(
        'email@test.com',
        'mypassword',
      );
    });
  });
});
