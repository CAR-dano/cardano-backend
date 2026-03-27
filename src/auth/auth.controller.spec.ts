/*
 * --------------------------------------------------------------------------
 * File: auth.controller.spec.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Unit tests for the AuthController.
 * --------------------------------------------------------------------------
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WalletAuthGuard } from './guards/wallet-auth.guard';
import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SecurityLoggerService } from '../security-logger/security-logger.service';
import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  user?: any;
}

// --- Mock Dependencies ---

const mockAuthService = {
  login: jest.fn(),
  blacklistToken: jest.fn().mockResolvedValue(undefined),
  refreshTokens: jest.fn(),
  revokeAllSessions: jest.fn(),
};

const mockUsersService = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findOrCreateByGoogleProfile: jest.fn(),
  updateUser: jest.fn(),
  createLocalUser: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest
    .fn()
    .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
};

const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

const mockResponse = {
  redirect: jest.fn(),
  cookie: jest.fn(),
  clearCookie: jest.fn(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
} as unknown as Response;

const mockSecurityLoggerService = {
  log: jest.fn().mockResolvedValue(undefined),
  extractRequestMeta: jest
    .fn()
    .mockReturnValue({ ip: '127.0.0.1', userAgent: 'test-agent' }),
};

// Base mock user for tests
const mockUserEntity = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: Role.ADMIN,
  walletAddress: null,
  whatsappNumber: null,
  isActive: true,
  password: 'hashed',
  googleId: null,
  hashedRefreshToken: null,
  sessionVersion: 1,
  pinHash: null,
  inspectionBranchCityId: null,
  inspectionBranchCity: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserResponseDto = new UserResponseDto(mockUserEntity as any);

const createMockRequest = (
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest =>
  ({
    headers: { authorization: 'Bearer mock-jwt-token' },
    ip: '127.0.0.1',
    socket: {},
    ...overrides,
  }) as unknown as AuthenticatedRequest;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SecurityLoggerService, useValue: mockSecurityLoggerService },
      ],
    })
      .overrideGuard(AuthGuard('google'))
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(WalletAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
    // restore default mock after clearAllMocks
    mockJwtService.decode.mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockSecurityLoggerService.extractRequestMeta.mockReturnValue({
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });
    mockAuthService.blacklistToken.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // registerLocal
  // ---------------------------------------------------------------------------
  describe('registerLocal', () => {
    const registerDto = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'P@ssword1',
    };

    it('should call usersService.createLocalUser and return UserResponseDto', async () => {
      mockUsersService.createLocalUser.mockResolvedValue(mockUserEntity);

      const result = await controller.registerLocal(registerDto as any);

      expect(mockUsersService.createLocalUser).toHaveBeenCalledWith(
        registerDto,
      );
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.email).toBe(mockUserEntity.email);
    });

    it('should propagate errors from usersService.createLocalUser', async () => {
      mockUsersService.createLocalUser.mockRejectedValue(new Error('Conflict'));

      await expect(
        controller.registerLocal(registerDto as any),
      ).rejects.toThrow('Conflict');
    });
  });

  // ---------------------------------------------------------------------------
  // loginLocal
  // ---------------------------------------------------------------------------
  describe('loginLocal', () => {
    it('should return LoginResponseDto with tokens when user is active', async () => {
      const req = createMockRequest({ user: mockUserEntity as any });
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.loginLocal(req);

      expect(mockAuthService.login).toHaveBeenCalledWith(mockUserEntity);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toBeInstanceOf(UserResponseDto);
    });

    it('should throw InternalServerErrorException when req.user is missing', async () => {
      const req = createMockRequest({ user: undefined });

      await expect(controller.loginLocal(req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw UnauthorizedException when user.isActive is false', async () => {
      const inactiveUser = { ...mockUserEntity, isActive: false };
      const req = createMockRequest({ user: inactiveUser as any });

      await expect(controller.loginLocal(req)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // loginInspector
  // ---------------------------------------------------------------------------
  describe('loginInspector', () => {
    const inspectorEntity = { ...mockUserEntity, role: Role.INSPECTOR };

    it('should return LoginResponseDto when inspector is active', async () => {
      const req = createMockRequest({ user: inspectorEntity as any });
      mockAuthService.login.mockResolvedValue({
        accessToken: 'insp-access',
        refreshToken: 'insp-refresh',
      });

      const result = await controller.loginInspector(req);

      expect(mockAuthService.login).toHaveBeenCalledWith(inspectorEntity);
      expect(result.accessToken).toBe('insp-access');
    });

    it('should throw InternalServerErrorException when req.user is missing', async () => {
      const req = createMockRequest({ user: undefined });

      await expect(controller.loginInspector(req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw UnauthorizedException when inspector.isActive is false', async () => {
      const inactiveInspector = { ...inspectorEntity, isActive: false };
      const req = createMockRequest({ user: inactiveInspector as any });

      await expect(controller.loginInspector(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // refreshTokens
  // ---------------------------------------------------------------------------
  describe('refreshTokens', () => {
    it('should call authService.refreshTokens with userId and return new tokens', async () => {
      const req = createMockRequest({ user: mockUserResponseDto as any });
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refreshTokens(req);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('user-123');
      expect(result.accessToken).toBe('new-access');
    });

    it('should throw InternalServerErrorException when req.user is missing', async () => {
      const req = createMockRequest({ user: undefined });

      await expect(controller.refreshTokens(req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // googleAuth
  // ---------------------------------------------------------------------------
  describe('googleAuth', () => {
    it('should call the method without errors (guard handles redirect)', async () => {
      await expect(controller.googleAuth({} as Request)).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // googleAuthRedirect
  // ---------------------------------------------------------------------------
  describe('googleAuthRedirect', () => {
    const clientUrl = 'http://localhost:3001';

    beforeEach(() => {
      mockConfigService.getOrThrow.mockReturnValue(clientUrl);
    });

    it('should redirect to frontend with tokens on success', async () => {
      const req = createMockRequest({ user: mockUserEntity as any });
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
      });

      await controller.googleAuthRedirect(req, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${clientUrl}/auth?token=access-tok&refreshToken=refresh-tok`,
      );
    });

    it('should redirect to error URL when req.user is missing', async () => {
      const req = createMockRequest({ user: undefined });

      await controller.googleAuthRedirect(req, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${clientUrl}/auth?error=authentication-failed`,
      );
    });

    it('should redirect to error URL when authService.login throws', async () => {
      const req = createMockRequest({ user: mockUserEntity as any });
      mockAuthService.login.mockRejectedValue(new Error('JWT error'));

      await controller.googleAuthRedirect(req, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `${clientUrl}/auth?error=authentication-failed`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------------
  describe('logout', () => {
    it('should blacklist token and return success message', async () => {
      const req = createMockRequest({ user: mockUserResponseDto as any });

      await controller.logout(req, mockResponse);

      expect(mockAuthService.blacklistToken).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Logout successful. Token has been invalidated on the server.',
      });
    });

    it('should throw UnauthorizedException when no token in header', async () => {
      const req = createMockRequest({
        user: mockUserResponseDto as any,
        headers: {},
      });

      await expect(controller.logout(req, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException when decoded token has no exp', async () => {
      mockJwtService.decode.mockReturnValue({ sub: 'user-123' }); // no exp
      const req = createMockRequest({ user: mockUserResponseDto as any });

      // The controller catches the UnauthorizedException internally and re-throws
      // as InternalServerErrorException from the outer catch block
      await expect(controller.logout(req, mockResponse)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when blacklistToken throws', async () => {
      mockAuthService.blacklistToken.mockRejectedValue(
        new Error('Redis error'),
      );
      const req = createMockRequest({ user: mockUserResponseDto as any });

      await expect(controller.logout(req, mockResponse)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getProfile
  // ---------------------------------------------------------------------------
  describe('getProfile', () => {
    it('should return the user object passed in', () => {
      const result = controller.getProfile(mockUserResponseDto);
      expect(result).toEqual(mockUserResponseDto);
    });
  });

  // ---------------------------------------------------------------------------
  // logoutAll
  // ---------------------------------------------------------------------------
  describe('logoutAll', () => {
    it('should revoke all sessions and blacklist current token, then return success', async () => {
      const req = createMockRequest({ user: mockUserResponseDto as any });
      mockAuthService.revokeAllSessions.mockResolvedValue(undefined);

      await controller.logoutAll(req, mockResponse);

      expect(mockAuthService.blacklistToken).toHaveBeenCalled();
      expect(mockAuthService.revokeAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        message:
          'All sessions revoked. You have been logged out from all devices.',
      });
    });

    it('should throw UnauthorizedException when userId is missing from req.user', async () => {
      const req = createMockRequest({ user: undefined });

      await expect(controller.logoutAll(req, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw InternalServerErrorException when revokeAllSessions throws', async () => {
      const req = createMockRequest({ user: mockUserResponseDto as any });
      mockAuthService.revokeAllSessions.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.logoutAll(req, mockResponse)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should proceed even when no bearer token exists (skip blacklist)', async () => {
      const req = createMockRequest({
        user: mockUserResponseDto as any,
        headers: {}, // no authorization header
      });
      mockAuthService.revokeAllSessions.mockResolvedValue(undefined);

      await controller.logoutAll(req, mockResponse);

      // blacklistToken should NOT be called since there's no token
      expect(mockAuthService.blacklistToken).not.toHaveBeenCalled();
      expect(mockAuthService.revokeAllSessions).toHaveBeenCalledWith(
        'user-123',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // checkTokenValidity
  // ---------------------------------------------------------------------------
  describe('checkTokenValidity', () => {
    it('should return { message: "Token is valid." }', () => {
      const result = controller.checkTokenValidity();
      expect(result).toEqual({ message: 'Token is valid.' });
    });
  });

  // ---------------------------------------------------------------------------
  // loginWallet
  // ---------------------------------------------------------------------------
  describe('loginWallet', () => {
    const walletUserEntity = {
      ...mockUserEntity,
      id: 'wallet-user-123',
      email: null,
      walletAddress: 'addr1qx2k8testwalletaddress',
      role: Role.CUSTOMER,
    };

    it('should return LoginResponseDto with tokens when wallet auth succeeds', async () => {
      const req = createMockRequest({ user: walletUserEntity as any });
      mockAuthService.login.mockResolvedValue({
        accessToken: 'wallet-access-token',
        refreshToken: 'wallet-refresh-token',
      });

      const result = await controller.loginWallet(req);

      expect(mockAuthService.login).toHaveBeenCalledWith(walletUserEntity);
      expect(result.accessToken).toBe('wallet-access-token');
      expect(result.refreshToken).toBe('wallet-refresh-token');
      expect(result.user).toBeInstanceOf(UserResponseDto);
    });

    it('should throw InternalServerErrorException when req.user is missing after guard', async () => {
      const req = createMockRequest({ user: undefined });

      await expect(controller.loginWallet(req)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should propagate InternalServerErrorException when authService.login throws', async () => {
      const req = createMockRequest({ user: walletUserEntity as any });
      mockAuthService.login.mockRejectedValue(
        new InternalServerErrorException('JWT signing failed'),
      );

      await expect(controller.loginWallet(req)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should log a security event on successful wallet login', async () => {
      const req = createMockRequest({ user: walletUserEntity as any });
      mockAuthService.login.mockResolvedValue({
        accessToken: 'wallet-access-token',
        refreshToken: 'wallet-refresh-token',
      });

      await controller.loginWallet(req);

      expect(mockSecurityLoggerService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({ method: 'wallet' }),
        }),
      );
    });
  });
});
