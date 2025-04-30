/**
 * @fileoverview This file contains unit tests for the GoogleStrategy.
 * It focuses on testing the `validate` method of the strategy, ensuring it
 * correctly interacts with the mocked AuthService to validate or create a user
 * based on the Google profile, and then calls the Passport `done` callback
 * with the appropriate arguments (error or user object).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { Profile, VerifyCallback } from 'passport-google-oauth20';

// --- Mock Dependencies ---

/**
 * Mock object for AuthService.
 * Provides a mock for the `validateUserGoogle` method called by the strategy.
 */
const mockAuthService = {
    validateUserGoogle: jest.fn(),
};

/**
 * Mock object for ConfigService.
 * Provides mocks for retrieving Google OAuth credentials and callback URL.
 * We also mock getOrThrow for consistency, though the actual values might not
 * be strictly necessary for testing the `validate` logic itself, as they are
 * used in the constructor which runs during module setup.
 */
const mockConfigService = {
    get: jest.fn(), // Might be used implicitly by Passport setup
    getOrThrow: jest.fn((key: string) => {
        // Provide dummy values for keys used in the constructor
        if (key === 'GOOGLE_CLIENT_ID') return 'mock-client-id';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'mock-client-secret';
        if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/api/v1/auth/google/callback';
        throw new Error(`Missing mock for config key: ${key}`);
    }),
};

/**
 * Test suite for the GoogleStrategy class.
 */
describe('GoogleStrategy', () => {
    let strategy: GoogleStrategy;
    let authService: AuthService;

    /**
     * Sets up the NestJS testing module before each test case.
     * Provides the GoogleStrategy itself and mocked versions of AuthService and ConfigService.
     */
    beforeEach(async () => {
        // Mock the configuration values needed by the strategy's constructor
        // This ensures the `super()` call in the strategy constructor works
        mockConfigService.getOrThrow
            .mockReturnValueOnce('mock-client-id')
            .mockReturnValueOnce('mock-client-secret')
            .mockReturnValueOnce('http://localhost:3000/api/v1/auth/google/callback');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleStrategy, // The strategy to test
                { provide: AuthService, useValue: mockAuthService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        strategy = module.get<GoogleStrategy>(GoogleStrategy);
        authService = module.get<AuthService>(AuthService); // Get the mock instance

        // Reset mocks before each test
        jest.clearAllMocks();
    });

    /**
     * Basic test to ensure the strategy instance is created correctly.
     */
    it('should be defined', () => {
        expect(strategy).toBeDefined();
    });

    /**
     * Test suite for the `validate` method of GoogleStrategy.
     * This method is the core logic executed after Google successfully authenticates the user.
     */
    describe('validate', () => {
        // Mock data simulating the profile returned by Google
        const mockGoogleProfile: Profile = {
            id: 'google-profile-id-123',
            displayName: 'Google Test User',
            name: { familyName: 'User', givenName: 'Google Test' },
            emails: [{ value: 'google.test@example.com', verified: true }],
            photos: [{ value: 'http://example.com/photo.jpg' }],
            provider: 'google',
            _raw: '',
            _json: { sub: 'google-profile-id-123', email: 'google.test@example.com', name: 'Google Test User', email_verified: true, iss: 'accounts.google.com', aud: 'client-id', iat: 1, exp: 1, picture: '', locale: 'en' },
            profileUrl: 'http://example.com/profile'
        };

        // Mock data simulating the user returned by AuthService
        const mockUser: User = {
            id: 'db-user-uuid-789',
            email: 'google.test@example.com',
            googleId: 'google-profile-id-123',
            name: 'Google Test User',
            role: Role.CUSTOMER,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Mock the `done` callback function provided by Passport
        let mockDone: VerifyCallback;

        // Reset the mock `done` function before each test in this suite
        beforeEach(() => {
            mockDone = jest.fn();
        });

        /**
         * Tests the successful validation scenario.
         * Expects `authService.validateUserGoogle` to be called with the profile,
         * and the `done` callback to be invoked with `null` (no error) and a
         * simplified user object containing essential fields.
         */
        it('should call authService.validateUserGoogle and call done with simplified user on success', async () => {
            // Arrange: Configure mock AuthService to return the mock user
            mockAuthService.validateUserGoogle.mockResolvedValue(mockUser);

            // Act: Call the validate method with mock data and the mock done callback
            await strategy.validate('mockAccessToken', undefined, mockGoogleProfile, mockDone);

            // Assert: Verify authService was called correctly
            expect(authService.validateUserGoogle).toHaveBeenCalledWith(mockGoogleProfile);
            expect(authService.validateUserGoogle).toHaveBeenCalledTimes(1);

            // Assert: Verify the 'done' callback was called with null error and the correct simplified user object
            const expectedSimplifiedUser = {
                id: mockUser.id,
                email: mockUser.email,
                name: mockUser.name,
                role: mockUser.role,
            };
            expect(mockDone).toHaveBeenCalledWith(null, expectedSimplifiedUser);
            expect(mockDone).toHaveBeenCalledTimes(1);
        });

        /**
         * Tests the scenario where `authService.validateUserGoogle` throws an error
         * (e.g., database issue, failed validation).
         * Expects the `done` callback to be invoked with the error object and `false`
         * (indicating validation failure).
         */
        it('should call done with error if authService.validateUserGoogle throws an error', async () => {
            // Arrange: Configure mock AuthService to throw an error
            const validationError = new InternalServerErrorException('Failed validation');
            mockAuthService.validateUserGoogle.mockRejectedValue(validationError);

            // Act: Call the validate method
            await strategy.validate('mockAccessToken', undefined, mockGoogleProfile, mockDone);

            // Assert: Verify authService was called
            expect(authService.validateUserGoogle).toHaveBeenCalledWith(mockGoogleProfile);
            expect(authService.validateUserGoogle).toHaveBeenCalledTimes(1);

            // Assert: Verify the 'done' callback was called with the error and false
            expect(mockDone).toHaveBeenCalledWith(validationError, false);
            expect(mockDone).toHaveBeenCalledTimes(1);
        });
    });
});