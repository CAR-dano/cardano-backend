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

// --- Mock Dependencies ---
/**
 * Mock object for the UsersService.
 * Provides Jest mock functions (`jest.fn()`) for methods that AuthService depends on.
 * This allows us to control the behavior (return value, error throwing) of UsersService
 * during the tests without needing a real implementation or database connection.
 */
const mockUsersService = {
  findOrCreateByGoogleProfile: jest.fn(),
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
      googleId: 'google123',
      name: 'Test User Google',
      role: Role.CUSTOMER, // Use the Role enum from Prisma client
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
    const mockUserLoginInput: {
      id: string;
      email: string;
      role: Role;
      name?: string;
    } = {
      id: 'user-uuid-456',
      email: 'login.user@example.com',
      role: Role.ADMIN, // Use Role enum
      name: 'Admin User',
    };

    // Define mock configuration values and the expected token.
    const mockJwtSecret = 'your-test-secret';
    const mockJwtExpiresIn = '3600s';
    const mockGeneratedToken = 'mock.jwt.token';

    /**
     * Tests if the login method correctly retrieves the JWT_SECRET and
     * JWT_EXPIRATION_TIME configuration values using the mocked ConfigService.
     */
    it('should call configService to get JWT secret and expiration', async () => {
      // Arrange: Mock the return values for the two expected calls to getOrThrow.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret) // First call for secret
        .mockReturnValueOnce(mockJwtExpiresIn); // Second call for expiration
      // Arrange: Mock the jwtService.sign to return a value (doesn't matter which for this test).
      mockJwtService.sign.mockReturnValue(mockGeneratedToken);

      // Act: Call the login method.
      await service.login(mockUserLoginInput);

      // Assert: Verify that getOrThrow was called twice with the correct keys.
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_EXPIRATION_TIME',
      );
      expect(configService.getOrThrow).toHaveBeenCalledTimes(2);
    });

    /**
     * Tests if the login method calls the jwtService.sign method with the correctly
     * constructed payload (based on user input) and the correct signing options
     * (secret and expiration time retrieved from ConfigService).
     */
    it('should call jwtService.sign with correct payload, secret, and expiration', async () => {
      // Arrange: Mock ConfigService return values.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn);
      // Arrange: Mock JwtService sign return value.
      mockJwtService.sign.mockReturnValue(mockGeneratedToken);

      // Act: Call the login method.
      await service.login(mockUserLoginInput);

      // Assert: Define the expected payload structure based on JwtPayload interface.
      const expectedPayload: JwtPayload = {
        sub: mockUserLoginInput.id,
        email: mockUserLoginInput.email,
        role: mockUserLoginInput.role,
        name: mockUserLoginInput.name,
      };
      // Assert: Define the expected options passed to sign.
      const expectedSignOptions = {
        secret: mockJwtSecret,
        expiresIn: mockJwtExpiresIn,
      };

      // Assert: Verify jwtService.sign was called once with the expected payload and options.
      expect(jwtService.sign).toHaveBeenCalledWith(
        expectedPayload,
        expectedSignOptions,
      );
      expect(jwtService.sign).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests if the login method successfully returns an object containing the
     * accessToken property, where the token value matches the one returned by the mocked
     * jwtService.sign method.
     */
    it('should return an object with the generated accessToken', async () => {
      // Arrange: Mock ConfigService and JwtService.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn);
      mockJwtService.sign.mockReturnValue(mockGeneratedToken);

      // Act: Call the login method.
      const result = await service.login(mockUserLoginInput);

      // Assert: Verify the returned object has the correct structure and value.
      expect(result).toEqual({ accessToken: mockGeneratedToken });
    });

    /**
     * Tests the error handling scenario where the underlying jwtService.sign method
     * throws an error (e.g., configuration issue, library error).
     * It expects the AuthService.login method to catch this error and throw a
     * specific InternalServerErrorException.
     */
    it('should throw InternalServerErrorException if jwtService.sign throws error', async () => {
      // Arrange: Mock ConfigService return values needed before the sign call.
      mockConfigService.getOrThrow
        .mockReturnValueOnce(mockJwtSecret)
        .mockReturnValueOnce(mockJwtExpiresIn);
      // Arrange: Configure the mock JwtService to throw an error when sign is called.
      const signError = new Error('Signing failed');
      mockJwtService.sign.mockImplementation(() => {
        throw signError;
      });

      // Act & Assert: Verify the call rejects with the expected exception.
      // The logger in AuthService should output the original 'Signing failed' error.
      await expect(service.login(mockUserLoginInput)).rejects.toThrow(
        new InternalServerErrorException('Failed to generate access token.'),
      );
    });
  });
});
