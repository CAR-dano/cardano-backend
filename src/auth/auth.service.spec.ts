/*
 * --------------------------------------------------------------------------
 * File: auth.service.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the AuthService.
 * This file uses NestJS testing utilities and Jest to test AuthService methods
 * in isolation by mocking its dependencies (UsersService, JwtService, ConfigService).
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { Profile } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// --- Mock Dependencies ---
/**
 * Mock object for the UsersService.
 * Provides Jest mock functions (`jest.fn()`) for methods that AuthService depends on.
 */
const mockUsersService = {
  findOrCreateByGoogleProfile: jest.fn(),
  updateUser: jest.fn(),
  findById: jest.fn(),
};

/**
 * Mock object for the JwtService.
 */
const mockJwtService = {
  sign: jest.fn(),
};

/**
 * Mock object for the ConfigService.
 */
const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

/**
 * Mock object for the PrismaService.
 * AuthService uses prisma.user.update() directly for security-sensitive field updates.
 */
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  blacklistedToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

/**
 * Mock object for the RedisService.
 */
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// Shared mock user used across multiple test suites
const buildMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid-456',
  email: 'login.user@example.com',
  name: 'Test User',
  username: 'testuser',
  password: 'hashedpassword',
  pin: null,
  refreshToken: 'hashed-refresh-token',
  sessionVersion: 0,
  whatsappNumber: null,
  walletAddress: null,
  googleId: null,
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
  ...overrides,
});

/**
 * Test suite for the AuthService class.
 */
describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // validateUserGoogle
  // ---------------------------------------------------------------------------
  describe('validateUserGoogle', () => {
    const mockGoogleProfile: Profile = {
      id: 'google123',
      displayName: 'Test User Google',
      name: { familyName: 'Google', givenName: 'Test User' },
      emails: [{ value: 'test.google@example.com', verified: true }],
      photos: [{ value: 'http://example.com/picture.jpg' }],
      provider: 'google',
      _raw: '',
      _json: {
        sub: 'google123',
        email: 'test.google@example.com',
        name: 'Test User Google',
        email_verified: true,
        iss: 'accounts.google.com',
        aud: 'mock-client-id.apps.googleusercontent.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        picture: 'http://example.com/picture.jpg',
        locale: 'en',
      },
      profileUrl: 'https://plus.google.com/mockprofileid',
    };

    const mockUser = buildMockUser({
      id: 'user-uuid-123',
      email: 'test.google@example.com',
      googleId: 'google123',
      role: Role.CUSTOMER,
    });

    it('should call usersService.findOrCreateByGoogleProfile with correct profile data', async () => {
      mockUsersService.findOrCreateByGoogleProfile.mockResolvedValue(mockUser);

      await service.validateUserGoogle(mockGoogleProfile);

      expect(usersService.findOrCreateByGoogleProfile).toHaveBeenCalledWith({
        id: mockGoogleProfile.id,
        emails: mockGoogleProfile.emails,
        displayName: mockGoogleProfile.displayName,
      });
      expect(usersService.findOrCreateByGoogleProfile).toHaveBeenCalledTimes(1);
    });

    it('should return the user found or created by usersService', async () => {
      mockUsersService.findOrCreateByGoogleProfile.mockResolvedValue(mockUser);

      const result = await service.validateUserGoogle(mockGoogleProfile);

      expect(result).toEqual(mockUser);
    });

    it('should throw InternalServerErrorException if usersService throws error', async () => {
      mockUsersService.findOrCreateByGoogleProfile.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.validateUserGoogle(mockGoogleProfile),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to validate Google user profile.',
        ),
      );
    });

    it('should throw InternalServerErrorException if profile has no email', async () => {
      const profileWithoutEmail: Profile = {
        ...mockGoogleProfile,
        emails: undefined,
        _json: {
          ...mockGoogleProfile._json,
          email: undefined,
          email_verified: false,
        },
      };

      await expect(
        service.validateUserGoogle(profileWithoutEmail),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to validate Google user profile.',
        ),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------------
  describe('login', () => {
    const mockUserLoginInput = {
      id: 'user-uuid-456',
      email: 'login.user@example.com',
      role: Role.ADMIN,
      sessionVersion: 0,
      name: 'Admin User',
      username: 'adminuser',
    };

    const mockJwtSecret = 'your-test-secret';
    const mockJwtExpiresIn = '3600s';
    const mockRefreshSecret = 'your-refresh-secret';
    const mockRefreshExpiresIn = '7d';
    const mockGeneratedToken = 'mock.jwt.token';
    const mockRefreshToken = 'mock.refresh.token';

    beforeEach(() => {
      // login() does prisma.user.update to persist hashed refresh token
      mockPrismaService.user.update.mockResolvedValue({});
    });

    it('should call configService to get JWT secrets and expirations', async () => {
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      await service.login(mockUserLoginInput);

      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_EXPIRATION_TIME',
      );
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRATION_TIME',
      );
      expect(configService.getOrThrow).toHaveBeenCalledTimes(4);
    });

    it('should call jwtService.sign with payload including sessionVersion', async () => {
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      await service.login(mockUserLoginInput);

      const expectedPayload = {
        sub: mockUserLoginInput.id,
        email: mockUserLoginInput.email,
        role: mockUserLoginInput.role,
        sessionVersion: mockUserLoginInput.sessionVersion,
        name: mockUserLoginInput.name,
        username: mockUserLoginInput.username,
      };

      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload, {
        secret: mockJwtSecret,
        expiresIn: mockJwtExpiresIn,
      });
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload, {
        secret: mockRefreshSecret,
        expiresIn: mockRefreshExpiresIn,
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should default sessionVersion to 0 when not provided', async () => {
      const inputWithoutVersion = {
        id: 'user-uuid-456',
        email: 'login.user@example.com',
        role: Role.ADMIN,
        // sessionVersion deliberately omitted
      };

      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      await service.login(inputWithoutVersion);

      // The first sign call should have sessionVersion: 0 in the payload
      const firstCallPayload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(firstCallPayload.sessionVersion).toBe(0);
    });

    it('should persist hashed refresh token via prisma.user.update', async () => {
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      await service.login(mockUserLoginInput);

      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: mockUserLoginInput.id });
      expect(updateCall.data.refreshToken).toBeDefined();
      expect(typeof updateCall.data.refreshToken).toBe('string');
    });

    it('should return an object with both generated tokens', async () => {
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      const result = await service.login(mockUserLoginInput);

      expect(result).toEqual({
        accessToken: mockGeneratedToken,
        refreshToken: mockRefreshToken,
      });
    });

    it('should throw InternalServerErrorException if jwtService.sign throws error', async () => {
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign.mockImplementation(() => {
        throw new Error('Signing failed');
      });

      await expect(service.login(mockUserLoginInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refreshTokens
  // ---------------------------------------------------------------------------
  describe('refreshTokens', () => {
    const mockJwtSecret = 'test-secret';
    const mockJwtExpiresIn = '3600s';
    const mockRefreshSecret = 'test-refresh-secret';
    const mockRefreshExpiresIn = '7d';

    beforeEach(() => {
      mockPrismaService.user.update.mockResolvedValue({});
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('nonexistent-id')).rejects.toThrow(
        new UnauthorizedException('Access Denied'),
      );
    });

    it('should increment sessionVersion and issue new token pair', async () => {
      const currentVersion = 2;
      const mockUser = buildMockUser({ sessionVersion: currentVersion });
      mockUsersService.findById.mockResolvedValue(mockUser);

      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      await service.refreshTokens(mockUser.id);

      // sessionVersion must be incremented in the DB before issuing new tokens
      const versionUpdateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(versionUpdateCall.where).toEqual({ id: mockUser.id });
      expect(versionUpdateCall.data.sessionVersion).toBe(currentVersion + 1);
    });

    it('should embed the incremented sessionVersion in the new tokens', async () => {
      const currentVersion = 1;
      const mockUser = buildMockUser({ sessionVersion: currentVersion });
      mockUsersService.findById.mockResolvedValue(mockUser);

      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      await service.refreshTokens(mockUser.id);

      // The second prisma.user.update call (from login()) stores the new refresh token hash
      // The JWT sign call payload must carry the new sessionVersion
      const signPayload = (jwtService.sign as jest.Mock).mock.calls[0][0];
      expect(signPayload.sessionVersion).toBe(currentVersion + 1);
    });

    it('should return new accessToken and refreshToken', async () => {
      const mockUser = buildMockUser({ sessionVersion: 0 });
      mockUsersService.findById.mockResolvedValue(mockUser);

      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshTokens(mockUser.id);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // revokeAllSessions
  // ---------------------------------------------------------------------------
  describe('revokeAllSessions', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.revokeAllSessions('nonexistent-id')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should increment sessionVersion and clear refreshToken in DB', async () => {
      const currentVersion = 3;
      const mockUser = buildMockUser({ sessionVersion: currentVersion });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.revokeAllSessions(mockUser.id);

      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(1);
      const updateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: mockUser.id });
      expect(updateCall.data.sessionVersion).toBe(currentVersion + 1);
      expect(updateCall.data.refreshToken).toBeNull();
    });

    it('should set sessionVersion to 1 when it starts at 0', async () => {
      const mockUser = buildMockUser({ sessionVersion: 0 });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.revokeAllSessions(mockUser.id);

      const updateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(updateCall.data.sessionVersion).toBe(1);
    });

    it('should resolve without error on success', async () => {
      const mockUser = buildMockUser({ sessionVersion: 0 });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      await expect(service.revokeAllSessions(mockUser.id)).resolves.toBeUndefined();
    });
  });
});
