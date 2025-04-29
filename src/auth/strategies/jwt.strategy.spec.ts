/**
 * @fileoverview This file contains unit tests for the JwtStrategy.
 * It focuses on testing the `validate` method of the strategy, ensuring it
 * correctly interacts with the mocked UsersService to fetch a user based on the
 * JWT payload's subject (user ID). It verifies that the correct user object
 * (excluding sensitive fields) is returned upon success, and an
 * UnauthorizedException is thrown if the user is not found.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// --- Mock Dependencies ---

/**
 * Mock object for UsersService.
 * Provides a mock for the `findById` method called by the JwtStrategy.
 */
const mockUsersService = {
    findById: jest.fn(),
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
        // Mock the config service return value before creating the module
        mockConfigService.getOrThrow.mockReturnValue('mock-test-secret');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JwtStrategy, // The strategy to test
                { provide: UsersService, useValue: mockUsersService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        strategy = module.get<JwtStrategy>(JwtStrategy);
        usersService = module.get<UsersService>(UsersService); // Get the mock instance

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
            googleId: null, // User might not have logged in via Google
            name: 'JWT Test User',
            role: Role.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        /**
         * Tests the successful validation scenario where the user is found.
         * Expects `usersService.findById` to be called with the user ID from the payload.
         * Expects the method to return the user object, excluding the 'googleId' field
         * (as defined in the strategy's return type).
         */
        it('should validate and return the user based on JWT payload', async () => {
            // Arrange: Configure mock UsersService to return the mock user when findById is called
            mockUsersService.findById.mockResolvedValue(mockUser);

            // Act: Call the validate method with the mock payload
            const result = await strategy.validate(mockJwtPayload);

            // Assert: Verify usersService.findById was called with the correct user ID
            expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
            expect(usersService.findById).toHaveBeenCalledTimes(1);

            // Assert: Verify the returned result contains the user data excluding googleId
            const { googleId, ...expectedResult } = mockUser; // Create expected result without googleId
            expect(result).toEqual(expectedResult);
        });

        /**
         * Tests the scenario where the user ID from the JWT payload does not
         * correspond to any user in the database (usersService.findById returns null).
         * Expects the method to throw an UnauthorizedException.
         */
        it('should throw an UnauthorizedException if user is not found', async () => {
            // Arrange: Configure mock UsersService to return null (user not found)
            mockUsersService.findById.mockResolvedValue(null);

            // Act & Assert: Expect the call to validate to reject with UnauthorizedException
            await expect(strategy.validate(mockJwtPayload)).rejects.toThrow(UnauthorizedException);

            // Assert: Verify usersService.findById was still called
            expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
            expect(usersService.findById).toHaveBeenCalledTimes(1);
        });

        /**
        * Tests the scenario where usersService.findById throws an unexpected error.
        * Expects the strategy's validate method to let the error propagate (or potentially
        * handle it, though typically Passport strategies let framework handle internal errors).
        * In this case, we'll test that the original error is thrown.
        */
        it('should throw the original error if usersService.findById fails unexpectedly', async () => {
            // Arrange: Configure mock UsersService to throw a generic error
            const dbError = new Error('Database connection error');
            mockUsersService.findById.mockRejectedValue(dbError);

            // Act & Assert: Expect the call to validate to reject with the specific dbError
            await expect(strategy.validate(mockJwtPayload)).rejects.toThrow(dbError);

            // Assert: Verify usersService.findById was still called
            expect(usersService.findById).toHaveBeenCalledWith(mockJwtPayload.sub);
            expect(usersService.findById).toHaveBeenCalledTimes(1);
        });
    });
});