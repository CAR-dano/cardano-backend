/*
 * --------------------------------------------------------------------------
 * File: jwt.strategy.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the JwtStrategy.
 * Tests the validation process of the JWT strategy,
 * including interactions with the UsersService mock.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { VaultConfigService } from '../../config/vault-config.service';

// --- Mock Dependencies ---

/**
 * Mock object for UsersService.
 * Provides a mock for the `findById` method called by the JwtStrategy.
 */
const mockUsersService = {
  findById: jest.fn(),
};

/**
 * Mock object for AuthService.
 */
const mockAuthService = {
  isTokenBlacklisted: jest.fn(),
};

/**
 * Mock object for ConfigService.
 * Provides a mock for retrieving the JWT_SECRET used in the strategy's constructor.
 */
const mockConfigService = {
  get: jest.fn(), // Might be used implicitly by Passport setup
  getOrThrow: jest.fn((key: string) => {
    // Provide dummy secret for constructor call
    if (key === 'JWT_SECRET') return 'mock-test-secret';
    throw new Error(`Missing mock for config key: ${key}`);
  }),
};

/** Minimal VaultConfigService mock — no Vault server needed in unit tests. */
const mockVaultConfigService: Partial<VaultConfigService> = {
  getSecrets: jest.fn().mockResolvedValue({}),
  get: jest.fn().mockResolvedValue(''),
  isVaultAvailable: jest.fn().mockReturnValue(false),
  invalidateCache: jest.fn(),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
};

/**
 * Test suite for the JwtStrategy class.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: UsersService;

  /**
   * Sets up the NestJS testing module before each test case.
   * Provides the JwtStrategy itself and mocked versions of UsersService and ConfigService.
   * Ensures the ConfigService mock returns a value for JWT_SECRET needed by the constructor.
   */
  beforeEach(async () => {
    mockConfigService.getOrThrow.mockReturnValue('mock-test-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy, // The strategy to test
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: VaultConfigService, useValue: mockVaultConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get<UsersService>(UsersService); // Get the mock instance

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  /**
  /**
   * Basic test to ensure the JwtStrategy instance is created correctly.
   */
  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  /**
   * Test suite for the `validate` method of JwtStrategy.
   * This method receives the decoded JWT payload and should return the authenticated user.
   */
  describe('validate', () => {
    // Mock data simulating a decoded JWT payload
    const mockJwtPayload: JwtPayload = {
      sub: 'user-jwt-id-123', // User ID
      email: 'jwt.user@example.com',
      role: Role.ADMIN,
      name: 'JWT Test User',
    };

    // Mock data simulating the full User object returned by UsersService
    const mockUser: User = {
      id: 'user-jwt-id-123',
      email: 'jwt.user@example.com',
      username: 'jwttest',
      password: 'hashedpassword',
      pin: null,
      refreshToken: null,
      sessionVersion: 0,
      whatsappNumber: null,
      walletAddress: null,
      googleId: null,
      name: 'JWT Test User',
      role: Role.ADMIN,
      isActive: true,
      google_avatar_url: null,
      profile_photo_url: null,
      profile_photo_storage_key: null,
      credits: 0,
      creditExpAt: null,
      inspectionBranchCityId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock Express Request
    const mockRequest = {
      headers: {
        authorization: 'Bearer mock-token',
      },
    } as unknown as Request;

    /**
     * Tests the successful validation scenario where the user is found.
     * Expects `usersService.findById` to be called with the user ID from the payload.
     * Expects the method to return the user object, excluding the 'googleId' field
     * (as defined in the strategy's return type).
     *
     * @param payload The decoded JWT payload.
     * @returns A promise that resolves to the user object (excluding sensitive fields).
     */
    it('should validate and return the user based on JWT payload', async () => {
      // Arrange: Configure mocks
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act: Call the validate method with the mock request and payload
      const result = await strategy.validate(mockRequest, mockJwtPayload);

      // Assert: Verify usersService.findById was called with the correct user ID
      expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(usersService.findById).toHaveBeenCalledTimes(1);

      // Assert: Verify the returned result contains the user data excluding password and googleId
      const { password: _p, googleId: _g, ...expectedResult } = mockUser;
      expect(result).toEqual(expectedResult);
    });

    /**
     * Tests the scenario where the user ID from the JWT payload does not
     * correspond to any user in the database (usersService.findById returns null).
     * Expects the method to throw an UnauthorizedException.
     *
     * @param payload The decoded JWT payload.
     * @returns A promise that rejects with UnauthorizedException.
     */
    it('should throw an UnauthorizedException if user is not found', async () => {
      // Arrange: Configure mocks
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert: Expect the call to validate to reject with UnauthorizedException
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);

      // Assert: Verify usersService.findById was still called
      expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(usersService.findById).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests the scenario where usersService.findById throws an unexpected error.
     * Expects the strategy's validate method to let the error propagate (or potentially
     * handle it, though typically Passport strategies let framework handle internal errors).
     * In this case, we'll test that the original error is thrown.
     *
     * @param payload The decoded JWT payload.
     * @returns A promise that rejects with the original error.
     */
    it('should throw the original error if usersService.findById fails unexpectedly', async () => {
      // Arrange: Configure mocks
      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      const dbError = new Error('Database connection error');
      mockUsersService.findById.mockRejectedValue(dbError);

      // Act & Assert: Expect the call to validate to reject with the specific dbError
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow(dbError);

      // Assert: Verify usersService.findById was still called
      expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
      expect(usersService.findById).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when token is not in the request', async () => {
      // Arrange: request with no Authorization header
      const requestWithoutToken = { headers: {} } as unknown as Request;

      // Act & Assert
      await expect(
        strategy.validate(requestWithoutToken, mockJwtPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUsersService.findById).not.toHaveBeenCalled();
    });

    it('should throw TokenBlacklistedException when token is blacklisted', async () => {
      // Arrange
      mockAuthService.isTokenBlacklisted.mockResolvedValue(true);

      // Act & Assert
      await expect(
        strategy.validate(mockRequest, mockJwtPayload),
      ).rejects.toThrow();
      expect(mockUsersService.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token sessionVersion is stale', async () => {
      // Arrange: token has sessionVersion 0, but DB user is already at version 1
      const stalePayload: JwtPayload = { ...mockJwtPayload, sessionVersion: 0 };
      const userWithNewerVersion: User = { ...mockUser, sessionVersion: 1 };

      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockUsersService.findById.mockResolvedValue(userWithNewerVersion);

      // Act & Assert
      await expect(
        strategy.validate(mockRequest, stalePayload),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should succeed when token sessionVersion matches the DB user sessionVersion', async () => {
      // Arrange: token and DB user share the same sessionVersion
      const payloadWithVersion: JwtPayload = {
        ...mockJwtPayload,
        sessionVersion: 3,
      };
      const userWithSameVersion: User = { ...mockUser, sessionVersion: 3 };

      mockAuthService.isTokenBlacklisted.mockResolvedValue(false);
      mockUsersService.findById.mockResolvedValue(userWithSameVersion);

      // Act
      const result = await strategy.validate(mockRequest, payloadWithVersion);

      // Assert: validation should pass and return user without password/googleId
      const {
        password: _p,
        googleId: _g,
        ...expectedResult
      } = userWithSameVersion;
      expect(result).toEqual(expectedResult);
    });
  });
});
