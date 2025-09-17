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
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { User, Role } from '@prisma/client';
import { BackblazeService } from '../common/services/backblaze.service';
import { AppLogger } from '../logging/app-logger.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

const mockBackblazeService = {
  uploadBuffer: jest.fn(),
  deleteFile: jest.fn(),
};

const mockLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
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
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService, // The service under test
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BackblazeService, useValue: mockBackblazeService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService); // Get the mock instance
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
      username: null,
      password: null,
      name: 'Test Email User',
      walletAddress: null,
      whatsappNumber: null,
      googleId: null,
      pin: null,
      refreshToken: null,
      role: Role.CUSTOMER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      inspectionBranchCityId: null,
      credits: 0,
      creditExpAt: null,
      profilePhotoUrl: '',
      profilePhotoStorageKey: null,
      googleAvatarUrl: null,
    };

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

      // Act & Assert: Expect the service call to reject with the same error
      await expect(service.findByEmail(testEmail)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testEmail },
        include: { inspectionBranchCity: true },
      });
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
      username: null,
      password: null,
      name: 'Test ID User',
      walletAddress: null,
      whatsappNumber: null,
      googleId: null,
      pin: null,
      refreshToken: null,
      role: Role.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      inspectionBranchCityId: null,
      credits: 0,
      creditExpAt: null,
      profilePhotoUrl: '',
      profilePhotoStorageKey: null,
      googleAvatarUrl: null,
    };

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

      // Act & Assert: Expect the service call to reject with the same error
      await expect(service.findById(testId)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
        include: { inspectionBranchCity: true },
      });
    });
  });

  /**
   * Test suite for the `findOrCreateByGoogleProfile` method.
   */
  describe('findOrCreateByGoogleProfile', () => {
    const baseDate = new Date();

    it('should update an existing user matched by email and attach Google metadata', async () => {
      const existingUser: User = {
        id: 'user-existing',
        email: 'existing.user@example.com',
        googleId: null,
        name: null,
        walletAddress: null,
        whatsappNumber: null,
        password: null,
        username: null,
        pin: null,
        refreshToken: null,
        role: Role.CUSTOMER,
        isActive: true,
        createdAt: baseDate,
        updatedAt: baseDate,
        inspectionBranchCityId: null,
        credits: 0,
        creditExpAt: null,
        profilePhotoUrl: '',
        profilePhotoStorageKey: null,
        googleAvatarUrl: null,
      } as any;

      const updatedUser = {
        ...existingUser,
        googleId: 'google-profile-id-456',
        name: 'New Google User',
        googleAvatarUrl: 'https://avatar.example.com',
        profilePhotoUrl: 'https://avatar.example.com',
      } as User;

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(existingUser); // email lookup
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.findOrCreateByGoogleProfile({
        id: 'google-profile-id-456',
        emails: [{ value: existingUser.email! }],
        displayName: 'New Google User',
        photos: [{ value: 'https://avatar.example.com' }],
      });

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { googleId: 'google-profile-id-456' },
      });
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'existinguser@example.com' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: expect.objectContaining({
          googleId: 'google-profile-id-456',
          googleAvatarUrl: 'https://avatar.example.com',
        }),
      });
      expect(result).toEqual(updatedUser);
    });

    it('should create a brand new user when email does not exist', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId lookup
        .mockResolvedValueOnce(null); // email lookup

      const createdUser = {
        id: 'new-user-id',
        email: 'new.google@example.com',
        googleId: 'google-profile-id-456',
        name: 'New Google User',
        role: Role.CUSTOMER,
        createdAt: baseDate,
        updatedAt: baseDate,
        profilePhotoUrl: 'https://avatar.example.com',
        googleAvatarUrl: 'https://avatar.example.com',
      } as unknown as User;

      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.findOrCreateByGoogleProfile({
        id: 'google-profile-id-456',
        emails: [{ value: 'new.google@example.com', verified: true }],
        displayName: 'New Google User',
        photos: [{ value: 'https://avatar.example.com' }],
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newgoogle@example.com',
          googleId: 'google-profile-id-456',
          profilePhotoUrl: 'https://avatar.example.com',
        }),
      });
      expect(result).toEqual(createdUser);
    });

    it('should throw ConflictException if googleId already linked to another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'other-user' });

      await expect(
        service.findOrCreateByGoogleProfile({
          id: 'google-profile-id-456',
          emails: [{ value: 'new.google@example.com' }],
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if profile has no email', async () => {
      const profileNoEmails = { id: 'google-profile-id-456', emails: undefined };
      const profileEmptyEmails = { id: 'google-profile-id-456', emails: [] };
      const profileNoEmailValue = {
        id: 'google-profile-id-456',
        emails: [{ value: undefined as any }],
      };

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
      const dbError = new Error('db failure');
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'user-existing',
          email: 'new.google@example.com',
          googleId: null,
          name: null,
          profilePhotoUrl: '',
          profilePhotoStorageKey: null,
        });
      mockPrismaService.user.update.mockRejectedValue(dbError);

      await expect(
        service.findOrCreateByGoogleProfile({
          id: 'google-profile-id-456',
          emails: [{ value: 'new.google@example.com' }],
        }),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Could not process Google user profile due to database error.',
        ),
      );
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSelfProfile', () => {
    const userId = 'user-id-123';

    it('should update provided profile fields', async () => {
      const updatedUser = { id: userId } as unknown as User;
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const dto = { name: 'New Name', whatsappNumber: '+62081234' };
      const result = await service.updateSelfProfile(userId, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: dto,
      });
      expect(result).toBe(updatedUser);
    });

    it('should return existing user when no fields provided', async () => {
      const existingUser = { id: userId } as unknown as User;
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.updateSelfProfile(userId, {});

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: { inspectionBranchCity: true },
      });
      expect(result).toBe(existingUser);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-id-123';
    const currentPassword = 'OldPassword1';
    const newPassword = 'NewPassword1';

    beforeEach(() => {
      (bcrypt.compare as jest.Mock).mockReset();
      (bcrypt.hash as jest.Mock).mockReset();
    });

    it('should update password when current password matches', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'stored-hash',
        refreshToken: 'refresh-token',
        googleId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      const updatedUser = { id: userId } as unknown as User;
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.changePassword(
        userId,
        currentPassword,
        newPassword,
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'stored-hash');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, expect.any(Number));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'new-hash', refreshToken: null },
      });
      expect(result).toBe(updatedUser);
    });

    it('should throw ForbiddenException when current password mismatches', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        password: 'stored-hash',
        refreshToken: 'refresh-token',
        googleId: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, currentPassword, newPassword),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should allow setting password when none exists without current password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        password: null,
        refreshToken: null,
        googleId: null,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      const updatedUser = { id: userId } as unknown as User;
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.changePassword(userId, undefined, newPassword);

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'new-hash', refreshToken: null },
      });
      expect(result).toBe(updatedUser);
    });
  });

  describe('linkGoogleAccount', () => {
    const userId = 'user-id-123';

    it('should link google account and update avatar when present', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // existing google link
        .mockResolvedValueOnce({
          id: userId,
          email: 'user@example.com',
          googleId: null,
          profilePhotoStorageKey: null,
          profilePhotoUrl: '',
          name: null,
        });

      const updatedUser = { id: userId, googleId: 'google-123' } as User;
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.linkGoogleAccount(
        userId,
        'google-123',
        'user@example.com',
        'https://avatar.example.com',
        'Display Name',
      );

      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, {
        where: { googleId: 'google-123' },
        select: { id: true },
      });
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { id: userId },
        include: { inspectionBranchCity: true },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          googleId: 'google-123',
          googleAvatarUrl: 'https://avatar.example.com',
        }),
      });
      expect(result).toBe(updatedUser);
    });

    it('should throw BadRequestException when google email mismatches user email', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: userId,
          email: 'different@example.com',
          googleId: null,
        });

      await expect(
        service.linkGoogleAccount(
          userId,
          'google-123',
          'user@example.com',
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when googleId already linked elsewhere', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'other-user' });

      await expect(
        service.linkGoogleAccount(userId, 'google-123', 'user@example.com'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
