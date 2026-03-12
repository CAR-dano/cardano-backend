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
import { InternalServerErrorException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { Profile } from 'passport-google-oauth20';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// --- Mock Dependencies ---
/**
 * Mock object for the UsersService.
 * Provides Jest mock functions (`jest.fn()`) for methods that AuthService depends on.
 * This allows us to control the behavior (return value, error throwing) of UsersService
 * during the tests without needing a real implementation or database connection.
 */
const mockUsersService = {
  findOrCreateByGoogleProfile: jest.fn(),
  updateUser: jest.fn(),
  findById: jest.fn(),
};

/**
 * Mock object for the JwtService.
 * Provides a Jest mock function for the `sign` method used to generate JWTs.
 */
const mockJwtService = {
  sign: jest.fn(),
};

/**
 * Mock object for the ConfigService.
 * Provides Jest mock functions for `get` and `getOrThrow` methods used to retrieve
 * configuration values (like JWT secrets and expiration times) from environment variables.
 */
const mockConfigService = {
  get: jest.fn(),
  getOrThrow: jest.fn(),
};

/**
 * Mock object for the PrismaService.
 * Provides Jest mock functions for database operations.
 */
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

/**
 * Mock object for the RedisService.
 * Provides Jest mock functions for caching operations.
 */
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

/**
 * Test suite for the AuthService class.
 * Groups all unit tests related to AuthService.
 */
describe('AuthService', () => {
  // Declare variables to hold instances of the service under test and its mocked dependencies.
  let service: AuthService;
  let usersService: UsersService; // Will hold the mock object
  let jwtService: JwtService; // Will hold the mock object
  let configService: ConfigService; // Will hold the mock object

  /**
   * Sets up the NestJS testing module before each test case runs.
   * This involves creating a module with the AuthService and mocked versions
   * of its dependencies (UsersService, JwtService, ConfigService).
   * It also retrieves instances of the service and mocks for use in tests
   * and clears all mock call history using jest.clearAllMocks() for test isolation.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService, // The actual service we want to test
        // Provide the mock objects instead of the real services
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile(); // Compile the module

    // Retrieve the instances from the testing module
    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService); // Retrieves the mock provided
    jwtService = module.get<JwtService>(JwtService); // Retrieves the mock provided
    configService = module.get<ConfigService>(ConfigService); // Retrieves the mock provided

    // Reset mocks before each test to prevent interference between tests
    jest.clearAllMocks();
  });

  /**
   * Basic sanity check test.
   * Ensures that the AuthService instance was successfully created and injected
   * by the NestJS testing module setup in beforeEach.
   */
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Test suite for the validateUserGoogle method of AuthService.
   * This method is responsible for taking a Google profile, interacting with
   * the UsersService to find or create a corresponding user in the database.
   */
  describe('validateUserGoogle', () => {
    // Define a mock Google Profile object conforming to the Profile type.
    // Includes necessary properties expected by the type definition.
    const mockGoogleProfile: Profile = {
      id: 'google123',
      displayName: 'Test User Google',
      name: { familyName: 'Google', givenName: 'Test User' },
      emails: [{ value: 'test.google@example.com', verified: true }],
      photos: [{ value: 'http://example.com/picture.jpg' }],
      provider: 'google',
      _raw: '', // Provide empty string or valid JSON string if needed
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

    // Define a mock User object representing the expected return value from UsersService.
    const mockUser: User = {
      id: 'user-uuid-123',
      email: 'test.google@example.com',
      name: 'Test User',
      username: 'testuser',
      password: 'hashedpassword',
      pin: '123456',
      refreshToken: 'mock-refresh-token',
      whatsappNumber: null,
      walletAddress: null,
      googleId: 'google123',
      role: Role.CUSTOMER,
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

    /**
     * Tests if validateUserGoogle correctly calls the findOrCreateByGoogleProfile method
     * on the mocked UsersService with the expected profile data extracted from the
     * input Google Profile object.
     */
    it('should call usersService.findOrCreateByGoogleProfile with correct profile data', async () => {
      // Arrange: Configure the mock UsersService to return the mockUser when called.
      mockUsersService.findOrCreateByGoogleProfile.mockResolvedValue(mockUser);

      // Act: Call the method under test.
      await service.validateUserGoogle(mockGoogleProfile);

      // Assert: Verify that the mock UsersService method was called exactly once
      // with an object containing the specific properties from mockGoogleProfile.
      expect(usersService.findOrCreateByGoogleProfile).toHaveBeenCalledWith({
        id: mockGoogleProfile.id,
        emails: mockGoogleProfile.emails,
        displayName: mockGoogleProfile.displayName,
      });
      expect(usersService.findOrCreateByGoogleProfile).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests if validateUserGoogle returns the user object that is resolved
     * by the mocked findOrCreateByGoogleProfile method of UsersService.
     */
    it('should return the user found or created by usersService', async () => {
      // Arrange: Configure the mock UsersService.
      mockUsersService.findOrCreateByGoogleProfile.mockResolvedValue(mockUser);

      // Act: Call the method under test.
      const result = await service.validateUserGoogle(mockGoogleProfile);

      // Assert: Verify that the returned result is strictly equal to the mockUser.
      expect(result).toEqual(mockUser);
    });

    /**
     * Tests the error handling scenario where the underlying usersService.findOrCreateByGoogleProfile
     * method throws an error (e.g., database connection issue). It expects
     * AuthService.validateUserGoogle to catch this and throw a specific
     * InternalServerErrorException, indicating a failure during validation.
     */
    it('should throw InternalServerErrorException if usersService throws error', async () => {
      // Arrange: Configure the mock UsersService to reject with an error.
      const errorMessage = 'Database error';
      mockUsersService.findOrCreateByGoogleProfile.mockRejectedValue(
        new Error(errorMessage),
      );

      // Act & Assert: Verify that calling the method under test results in a rejection
      // that is an instance of InternalServerErrorException with the expected message.
      // The logger within AuthService should also output the original error message.
      await expect(
        service.validateUserGoogle(mockGoogleProfile),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to validate Google user profile.',
        ),
      );
    });

    /**
     * Tests the specific error scenario where the input Google profile is missing
     * the email address, which is required by the application logic.
     * It expects the service (ultimately catching the error from UsersService)
     * to throw an InternalServerErrorException.
     */
    it('should throw InternalServerErrorException if profile has no email', async () => {
      // Arrange: Create a profile variant without the email property.
      const profileWithoutEmail: Profile = {
        ...mockGoogleProfile,
        emails: undefined, // Simulate missing email
        _json: {
          ...mockGoogleProfile._json,
          email: undefined,
          email_verified: false,
        },
      };

      // Act & Assert: Expect the call to reject with the specific InternalServerErrorException.
      // The UsersService's findOrCreate method is expected to handle the missing email initially,
      // and AuthService catches this failure.
      await expect(
        service.validateUserGoogle(profileWithoutEmail),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to validate Google user profile.',
        ),
      );
    });
  });

  /**
   * Test suite for the login method of AuthService.
   * This method is responsible for generating a JWT access token for an already
   * validated user, interacting with ConfigService and JwtService.
   */
  describe('login', () => {
    // Define mock user data that would be passed to the login method.
    const mockUserLoginInput = {
      id: 'user-uuid-456',
      email: 'login.user@example.com',
      role: Role.ADMIN,
      name: 'Admin User',
      username: 'adminuser',
    };

    // Define mock configuration values and the expected token.
    const mockJwtSecret = 'your-test-secret';
    const mockJwtExpiresIn = '3600s';
    const mockRefreshSecret = 'your-refresh-secret';
    const mockRefreshExpiresIn = '7d';
    const mockGeneratedToken = 'mock.jwt.token';
    const mockRefreshToken = 'mock.refresh.token';

    /**
     * Tests if the login method correctly retrieves the JWT_SECRET and
     * JWT_EXPIRATION_TIME configuration values using the mocked ConfigService.
     */
    it('should call configService to get JWT secrets and expirations', async () => {
      // Arrange: Mock the return values for the expected calls to getOrThrow.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret) // JWT_SECRET
        .mockReturnValueOnce(mockJwtExpiresIn) // JWT_EXPIRATION_TIME
        .mockReturnValueOnce(mockRefreshSecret) // JWT_REFRESH_SECRET
        .mockReturnValueOnce(mockRefreshExpiresIn); // JWT_REFRESH_EXPIRATION_TIME

      // Arrange: Mock the jwtService.sign to return different values for access and refresh tokens.
      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      // Act: Call the login method.
      await service.login(mockUserLoginInput);

      // Assert: Verify that getOrThrow was called for all 4 keys.
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_EXPIRATION_TIME');
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_REFRESH_EXPIRATION_TIME');
      expect(configService.getOrThrow).toHaveBeenCalledTimes(4);
    });

    /**
     * Tests if the login method calls the jwtService.sign method with the correctly
     * constructed payload (based on user input) and the correct signing options.
     */
    it('should call jwtService.sign with correct payload, secret, and expiration', async () => {
      // Arrange: Mock ConfigService return values.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      // Arrange: Mock JwtService sign.
      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      // Act: Call the login method.
      await service.login(mockUserLoginInput);

      // Payload structure as expected by AuthService.login
      const expectedPayload = {
        sub: mockUserLoginInput.id,
        email: mockUserLoginInput.email,
        role: mockUserLoginInput.role,
        name: mockUserLoginInput.name,
        username: mockUserLoginInput.username,
      };

      // Verify sign was called for both access and refresh tokens
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

    /**
     * Tests if the login method successfully returns an object containing both
     * accessToken and refreshToken.
     */
    it('should return an object with both generated tokens', async () => {
      // Arrange: Mock ConfigService and JwtService.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      mockJwtService.sign
        .mockReturnValueOnce(mockGeneratedToken)
        .mockReturnValueOnce(mockRefreshToken);

      // Act: Call the login method.
      const result = await service.login(mockUserLoginInput);

      // Assert: Verify the returned object has the correct structure and values.
      expect(result).toEqual({
        accessToken: mockGeneratedToken,
        refreshToken: mockRefreshToken,
      });
    });

    it('should throw InternalServerErrorException if jwtService.sign throws error', async () => {
      // Arrange: Mock ConfigService.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn)
        .mockReturnValueOnce(mockRefreshSecret)
        .mockReturnValueOnce(mockRefreshExpiresIn);

      // Arrange: Configure the mock JwtService to throw an error.
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('Signing failed');
      });

      // Act & Assert: Verify the call rejects with the expected exception.
      await expect(service.login(mockUserLoginInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
