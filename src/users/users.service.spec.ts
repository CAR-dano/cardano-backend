/**
 * @fileoverview This file contains unit tests for the UsersService.
 * It tests the service's methods for finding and creating/updating users,
 * ensuring correct interaction with the mocked PrismaService.
 * The actual database is not involved in these tests.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { User, Role } from '@prisma/client';
import { RedisService } from '../redis/redis.service';

// --- Mock PrismaService ---
/**
 * Mock object for PrismaService.
 * We need to mock the specific Prisma Client delegate methods that UsersService uses,
 * which are accessed via `prisma.user`.
 */
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  inspectionBranchCity: {
    findUnique: jest.fn(),
  },
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

/**
 * Test suite for the UsersService class.
 */
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService; // Will hold the mock object

  /**
   * Sets up the NestJS testing module before each test case.
   * Provides the UsersService and the mocked PrismaService.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService); // Get the mock instance

    // Reset mocks before each test for isolation
    jest.clearAllMocks();
  });

  /**
   * Basic test to ensure the service instance is created correctly.
   */
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Test suite for the `findByEmail` method.
   */
  describe('findByEmail', () => {
    const testEmail = 'test@example.com';
    const mockUser: User = {
      id: 'uuid-email-1',
      email: testEmail,
      name: 'Test Email User',
      googleId: null,
      role: Role.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    /**
     * Tests the scenario where a user with the given email exists.
     * Expects prisma.user.findUnique to be called correctly and return the user.
     */
    it('should return a user if found by email', async () => {
      // Arrange: Mock findUnique to return the user
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act: Call the service method
      const result = await service.findByEmail(testEmail);

      // Assert: Check prisma call and result
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testEmail },
        include: { inspectionBranchCity: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    /**
     * Tests the scenario where no user with the given email exists.
     * Expects prisma.user.findUnique to be called correctly and return null.
     */
    it('should return null if user is not found by email', async () => {
      // Arrange: Mock findUnique to return null
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act: Call the service method
      const result = await service.findByEmail(testEmail);

      // Assert: Check prisma call and result
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testEmail },
        include: { inspectionBranchCity: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    /**
     * Tests how the service handles errors from the Prisma client during findUnique.
     * Expects the original Prisma error to be thrown.
     */
    it('should throw an error if Prisma findUnique fails', async () => {
      // Arrange: Mock findUnique to throw an error
      const dbError = new Error('Database connection failed');
      mockPrismaService.user.findUnique.mockRejectedValue(dbError);

      // Act & Assert: Expect the service call to reject with InternalServerErrorException
      await expect(service.findByEmail(testEmail)).rejects.toThrow(
        new InternalServerErrorException('Database error while finding user by email.'),
      );
    });
  });

  /**
   * Test suite for the `findById` method.
   */
  describe('findById', () => {
    const testId = 'uuid-id-1';
    const mockUser: User = {
      id: testId,
      email: 'id@example.com',
      name: 'Test ID User',
      googleId: null,
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    /**
     * Tests the scenario where a user with the given ID exists.
     * Expects prisma.user.findUnique to be called correctly and return the user.
     */
    it('should return a user if found by ID', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(testId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
        include: { inspectionBranchCity: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    /**
     * Tests the scenario where no user with the given ID exists.
     * Expects prisma.user.findUnique to be called correctly and return null.
     * Note: The service itself doesn't throw NotFoundException here, consistent with its code.
     */
    it('should return null if user is not found by ID', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findById(testId);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
        include: { inspectionBranchCity: true },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    /**
     * Tests how the service handles errors from the Prisma client during findUnique by ID.
     * Expects the original Prisma error to be thrown.
     */
    it('should throw an error if Prisma findUnique fails', async () => {
      // Arrange: Mock findUnique to throw an error
      const dbError = new Error('Database query failed');
      mockPrismaService.user.findUnique.mockRejectedValue(dbError);

      // Act & Assert: Expect the service call to reject with InternalServerErrorException
      await expect(service.findById(testId)).rejects.toThrow(
        new InternalServerErrorException('Database error while finding user by ID.'),
      );
    });
  });

  /**
   * Test suite for the `findOrCreateByGoogleProfile` method.
   */
  describe('findOrCreateByGoogleProfile', () => {
    // Mock Google profile structure used as input
    const mockGoogleProfileInput = {
      id: 'google-profile-id-456',
      emails: [{ value: 'new.google@example.com', verified: true }],
      displayName: 'New Google User',
    };

    // Mock User object expected to be returned by upsert
    const mockUpsertedUser: User = {
      id: 'uuid-upsert-1',
      email: 'new.google@example.com',
      googleId: 'google-profile-id-456',
      name: 'New Google User',
      role: Role.CUSTOMER, // Assuming default role
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    /**
     * Tests the successful execution of the upsert operation.
     * Expects prisma.user.upsert to be called with the correct arguments
     * (where, update, create clauses) derived from the Google profile.
     * Expects the method to return the user object returned by prisma.user.upsert.
     */
    it('should call prisma.user.upsert with correct arguments and return the user', async () => {
      // Arrange: Mock upsert to return the expected user
      mockPrismaService.user.upsert.mockResolvedValue(mockUpsertedUser);

      // Act: Call the service method
      const result = await service.findOrCreateByGoogleProfile(
        mockGoogleProfileInput,
      );

      const normalizedEmail = 'newgoogle@example.com';
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: normalizedEmail },
        update: { googleId: mockGoogleProfileInput.id },
        create: {
          id: expect.any(String),
          email: normalizedEmail,
          googleId: mockGoogleProfileInput.id,
          name: mockGoogleProfileInput.displayName || 'User', // Match default logic
        },
      });
      expect(prisma.user.upsert).toHaveBeenCalledTimes(1);

      // Assert: Verify the result matches the user returned by upsert
      expect(result).toEqual(mockUpsertedUser);
    });

    /**
     * Tests the specific validation check within the service method itself:
     * if the input profile is missing the email array or the first email value.
     * Expects an InternalServerErrorException to be thrown before Prisma is called.
     */
    it('should throw InternalServerErrorException if profile has no email', async () => {
      // Arrange: Create profile variations without email
      const profileNoEmails = { ...mockGoogleProfileInput, emails: undefined };
      const profileEmptyEmails = { ...mockGoogleProfileInput, emails: [] };
      const profileNoEmailValue = {
        ...mockGoogleProfileInput,
        emails: [{ value: undefined as any }],
      }; // Simulate missing value

      // Act & Assert: Test each case
      await expect(
        service.findOrCreateByGoogleProfile(profileNoEmails),
      ).rejects.toThrow(
        new InternalServerErrorException('Google profile is missing email.'),
      );
      await expect(
        service.findOrCreateByGoogleProfile(profileEmptyEmails),
      ).rejects.toThrow(
        new InternalServerErrorException('Google profile is missing email.'),
      );
      await expect(
        service.findOrCreateByGoogleProfile(profileNoEmailValue),
      ).rejects.toThrow(
        new InternalServerErrorException('Google profile is missing email.'),
      );

      // Assert: Ensure Prisma was never called in these error cases
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    /**
     * Tests the error handling scenario where prisma.user.upsert throws an error.
     * Expects the service method to catch the Prisma error and re-throw a specific
     * InternalServerErrorException.
     */
    it('should throw InternalServerErrorException if prisma.user.upsert fails', async () => {
      // Arrange: Mock upsert to throw an error
      const dbError = new Error(
        'Unique constraint failed or DB connection error',
      );
      mockPrismaService.user.upsert.mockRejectedValue(dbError);

      // Act & Assert: Expect the service call to reject with the specific InternalServerErrorException
      await expect(
        service.findOrCreateByGoogleProfile(mockGoogleProfileInput),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Could not process Google user profile due to database error.',
        ),
      );

      expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test suite for the `findAll` method.
   */
  describe('findAll', () => {
    const mockUsers = [
      { id: '1', role: Role.ADMIN },
      { id: '2', role: Role.CUSTOMER },
      { id: '3', role: Role.SUPERADMIN },
    ];

    it('should filter out SUPERADMIN if acting role is not SUPERADMIN', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(
        mockUsers.filter((u) => u.role !== Role.SUPERADMIN),
      );

      const result = await service.findAll(Role.ADMIN);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: { not: Role.SUPERADMIN } },
        include: { inspectionBranchCity: true },
      });
      expect(result.find((u) => u.role === Role.SUPERADMIN)).toBeUndefined();
    });

    it('should include SUPERADMIN if acting role is SUPERADMIN', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll(Role.SUPERADMIN);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        include: { inspectionBranchCity: true },
      });
      expect(result.find((u) => u.role === Role.SUPERADMIN)).toBeDefined();
    });
  });

  /**
   * Test suite for the `updateUser` method.
   */
  describe('updateUser', () => {
    const targetId = 'target-id';
    const updateDto = { name: 'Updated Name' };

    it('should throw ForbiddenException if an ADMIN tries to update a SUPERADMIN', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: targetId,
        role: Role.SUPERADMIN,
      });

      await expect(
        service.updateUser(targetId, updateDto as any, Role.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow a SUPERADMIN to update another SUPERADMIN', async () => {
      const targetUser = { id: targetId, role: Role.SUPERADMIN, email: 'sa@test.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.update.mockResolvedValue({ ...targetUser, ...updateDto });

      const result = await service.updateUser(targetId, updateDto as any, Role.SUPERADMIN);

      expect(result.name).toBe('Updated Name');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  /**
   * Test suite for the `deleteUser` method.
   */
  describe('deleteUser', () => {
    const targetId = 'target-id';

    it('should throw ForbiddenException if an ADMIN tries to delete a SUPERADMIN', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: targetId,
        role: Role.SUPERADMIN,
      });

      await expect(
        service.deleteUser(targetId, Role.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow a SUPERADMIN to delete another SUPERADMIN', async () => {
      const targetUser = { id: targetId, role: Role.SUPERADMIN, email: 'sa@test.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.delete.mockResolvedValue(targetUser);

      await service.deleteUser(targetId, Role.SUPERADMIN);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: targetId },
      });
    });
  });
});
