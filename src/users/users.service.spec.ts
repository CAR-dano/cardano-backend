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
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { User, Role, Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { SecurityLoggerService } from '../security-logger/security-logger.service';

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
  executeWithReconnect: jest
    .fn()
    .mockImplementation((_label: string, fn: () => unknown) => fn()),
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

const mockSecurityLoggerService = {
  log: jest.fn().mockResolvedValue(undefined),
  extractRequestMeta: jest
    .fn()
    .mockReturnValue({ ip: undefined, userAgent: undefined }),
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
        { provide: SecurityLoggerService, useValue: mockSecurityLoggerService },
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
        new InternalServerErrorException(
          'Database error while finding user by email.',
        ),
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
        new InternalServerErrorException(
          'Database error while finding user by ID.',
        ),
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
      const targetUser = {
        id: targetId,
        role: Role.SUPERADMIN,
        email: 'sa@test.com',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...targetUser,
        ...updateDto,
      });

      const result = await service.updateUser(
        targetId,
        updateDto as any,
        Role.SUPERADMIN,
      );

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

      await expect(service.deleteUser(targetId, Role.ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow a SUPERADMIN to delete another SUPERADMIN', async () => {
      const targetUser = {
        id: targetId,
        role: Role.SUPERADMIN,
        email: 'sa@test.com',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.delete.mockResolvedValue(targetUser);

      await service.deleteUser(targetId, Role.SUPERADMIN);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: targetId },
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe('createInspector', () => {
    const dto = {
      email: 'inspector@example.com',
      username: 'insp01',
      name: 'Inspektor Satu',
      walletAddress: 'addr1abc',
      whatsappNumber: '628123456789',
      inspectionBranchCityId: 'branch-uuid',
    };

    const branchCity = {
      id: 'branch-uuid',
      city: 'Yogyakarta',
      code: 'YOG',
      isActive: true,
    };
    const createdUser = {
      id: 'new-user-id',
      email: 'inspector@example.com',
      username: 'insp01',
      name: 'Inspektor Satu',
      role: Role.INSPECTOR,
      pin: 'hashedPin',
      inspectionBranchCity: branchCity,
    };

    it('should create inspector and return user with plainPin', async () => {
      // No conflicts
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(
        branchCity,
      );
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.createInspector(dto as any);

      expect(result.id).toBe('new-user-id');
      expect(result.plainPin).toMatch(/^\d{6}$/);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      // findByEmail hits cache (null) then DB returns a user
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce({ id: 'existing', email: dto.email }) // by email (findByEmail)
        .mockResolvedValue(null);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(
        branchCity,
      );

      await expect(service.createInspector(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when username already exists', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing', username: dto.username }) // username check
        .mockResolvedValue(null);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(
        branchCity,
      );

      await expect(service.createInspector(dto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when branch city not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(service.createInspector(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException after exhausting PIN retry attempts', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(
        branchCity,
      );

      // All create attempts fail with pin collision
      const pinConflict = new Prisma.PrismaClientKnownRequestError(
        'pin collision',
        {
          code: 'P2002',
          clientVersion: '0.0.0',
          meta: { target: ['pin'] },
        },
      );
      mockPrismaService.user.create.mockRejectedValue(pinConflict);

      await expect(service.createInspector(dto as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findAllInspectors', () => {
    it('should return all inspector users', async () => {
      const inspectors = [
        { id: 'i1', role: Role.INSPECTOR },
        { id: 'i2', role: Role.INSPECTOR },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(inspectors);

      const result = await service.findAllInspectors();

      expect(result).toEqual(inspectors);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: Role.INSPECTOR },
        include: { inspectionBranchCity: true },
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.user.findMany.mockRejectedValue(new Error('DB fail'));

      await expect(service.findAllInspectors()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('updateInspector', () => {
    const inspectorId = 'insp-id';
    const inspector = {
      id: inspectorId,
      role: Role.INSPECTOR,
      email: 'insp@example.com',
      username: 'insp01',
    };

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInspector(inspectorId, { name: 'New Name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is not an inspector', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...inspector,
        role: Role.ADMIN,
      });

      await expect(
        service.updateInspector(inspectorId, { name: 'New Name' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update inspector and return updated user', async () => {
      const updated = { ...inspector, name: 'New Name' };
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.updateInspector(inspectorId, {
        name: 'New Name',
      } as any);

      expect(result.name).toBe('New Name');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when provided branchCityId does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      mockPrismaService.inspectionBranchCity.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInspector(inspectorId, {
          name: 'X',
          inspectionBranchCityId: 'bad-id',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on P2002 email collision', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['email'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(
        service.updateInspector(inspectorId, {
          email: 'taken@example.com',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on general DB error', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      mockPrismaService.user.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateInspector(inspectorId, { name: 'X' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('generatePin (resetInspectorPin)', () => {
    const inspectorId = 'insp-id';
    const inspector = {
      id: inspectorId,
      role: Role.INSPECTOR,
      username: 'insp01',
      pin: null,
    };

    it('should throw NotFoundException when inspector not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.generatePin(inspectorId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when user is not an inspector', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...inspector,
        role: Role.ADMIN,
      });

      await expect(service.generatePin(inspectorId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should generate a new PIN and return user with plainPin', async () => {
      const updated = { ...inspector, pin: 'newHashedPin' };
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.generatePin(inspectorId);

      expect(result.plainPin).toMatch(/^\d{6}$/);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: inspectorId },
        data: expect.objectContaining({ pin: expect.any(String) }),
      });
    });

    it('should retry on pin hash collision and succeed on 2nd attempt', async () => {
      const updated = { ...inspector, pin: 'newHashedPin' };
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);

      const pinConflict = new Prisma.PrismaClientKnownRequestError(
        'pin collision',
        {
          code: 'P2002',
          clientVersion: '0.0.0',
          meta: { target: ['pin'] },
        },
      );
      mockPrismaService.user.update
        .mockRejectedValueOnce(pinConflict) // first attempt fails
        .mockResolvedValue(updated); // second attempt succeeds

      const result = await service.generatePin(inspectorId);

      expect(result.id).toBe(inspectorId);
      expect(mockPrismaService.user.update).toHaveBeenCalledTimes(2);
    });

    it('should throw InternalServerErrorException after exhausting PIN retries', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(inspector);
      const pinConflict = new Prisma.PrismaClientKnownRequestError(
        'pin collision',
        {
          code: 'P2002',
          clientVersion: '0.0.0',
          meta: { target: ['pin'] },
        },
      );
      mockPrismaService.user.update.mockRejectedValue(pinConflict);

      await expect(service.generatePin(inspectorId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findByEmail — cache paths', () => {
    const testEmail = 'cache@example.com';
    const mockUser = {
      id: 'cached-id',
      email: 'cacheexample@example.com',
      role: Role.ADMIN,
    } as User;

    it('should return cached user from Redis when cache hit', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockUser));

      const result = await service.findByEmail(testEmail);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fall through to DB when Redis returns null (cache miss)', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail(testEmail);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should return null for empty email', async () => {
      const result = await service.findByEmail('');
      expect(result).toBeNull();
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should populate Redis cache when user found in DB', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await service.findByEmail(testEmail);

      expect(mockRedisService.set).toHaveBeenCalled();
    });

    it('should continue to DB if Redis.get throws', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis down'));
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail(testEmail);
      expect(result).toEqual(mockUser);
    });
  });

  // ---------------------------------------------------------------------------
  describe('findById — cache paths', () => {
    const testId = 'cached-user-id';
    const mockUser = {
      id: testId,
      email: 'byid@example.com',
      role: Role.ADMIN,
    } as User;

    it('should return null for empty id', async () => {
      const result = await service.findById('');
      expect(result).toBeNull();
    });

    it('should return cached user when Redis has a hit', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify(mockUser));

      const result = await service.findById(testId);

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should continue to DB if Redis.get throws', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Redis down'));
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(testId);
      expect(result).toEqual(mockUser);
    });
  });

  // ---------------------------------------------------------------------------
  describe('findByUsername', () => {
    it('should return null for empty username', async () => {
      const result = await service.findByUsername('');
      expect(result).toBeNull();
    });

    it('should return user when found', async () => {
      const user = { id: 'u1', username: 'john' } as User;
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findByUsername('john');
      expect(result).toEqual(user);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('DB fail'));

      await expect(service.findByUsername('john')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findByWalletAddress', () => {
    it('should return null for empty walletAddress', async () => {
      const result = await service.findByWalletAddress('');
      expect(result).toBeNull();
    });

    it('should return user when found', async () => {
      const user = { id: 'u1', walletAddress: 'addr1abc' } as User;
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findByWalletAddress('addr1abc');
      expect(result).toEqual(user);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('DB fail'));

      await expect(service.findByWalletAddress('addr1abc')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('createLocalUser', () => {
    const registerDto = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'secret123',
      name: 'New User',
    };

    it('should create user and return new user object', async () => {
      // No existing email or username
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const created = {
        id: 'new-id',
        email: 'newexample@example.com',
        username: 'newuser',
      };
      mockPrismaService.user.create.mockResolvedValue(created);

      const result = await service.createLocalUser(registerDto as any);

      expect(result).toEqual(created);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when email is taken', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'existing',
      }); // email check

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when username is taken', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing' }); // username check

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on P2002 email violation at DB level', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['email'] },
      });
      mockPrismaService.user.create.mockRejectedValue(conflict);

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on P2002 username violation at DB level', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['username'] },
      });
      mockPrismaService.user.create.mockRejectedValue(conflict);

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException on P2002 walletAddress violation at DB level', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['walletAddress'] },
      });
      mockPrismaService.user.create.mockRejectedValue(conflict);

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on general DB error', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockRejectedValue(new Error('DB down'));

      await expect(service.createLocalUser(registerDto as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('updateRole', () => {
    const actingId = 'admin-id';
    const targetId = 'target-id';
    const targetUser = {
      id: targetId,
      role: Role.CUSTOMER,
      email: 'c@example.com',
    };

    it('should throw BadRequestException if acting user tries to change own role', async () => {
      await expect(
        service.updateRole(actingId, Role.ADMIN, actingId, Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole(targetId, Role.ADMIN, actingId, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when ADMIN tries to change SUPERADMIN role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...targetUser,
        role: Role.SUPERADMIN,
      });

      await expect(
        service.updateRole(targetId, Role.ADMIN, actingId, Role.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update role successfully', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      const updatedUser = { ...targetUser, role: Role.ADMIN };
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateRole(
        targetId,
        Role.ADMIN,
        actingId,
        Role.SUPERADMIN,
      );

      expect(result.role).toBe(Role.ADMIN);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: targetId },
        data: { role: Role.ADMIN },
      });
    });

    it('should throw InternalServerErrorException on DB error during update', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.update.mockRejectedValue(new Error('DB fail'));

      await expect(
        service.updateRole(targetId, Role.ADMIN, actingId, Role.SUPERADMIN),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('linkGoogleAccount', () => {
    const userId = 'user-id';
    const googleId = 'google-id-123';
    const googleEmail = 'user@gmail.com';
    const existingUser = {
      id: userId,
      email: 'user@gmail.com',
      googleId: null,
      walletAddress: null,
    } as User;

    it('should throw ConflictException if googleId is already linked to another user', async () => {
      // findByGoogleId — another user has this googleId
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'other-user',
      }); // googleId lookup

      await expect(
        service.linkGoogleAccount(userId, googleId, googleEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user to link is not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId not linked
        .mockResolvedValueOnce(null); // findById returns null

      await expect(
        service.linkGoogleAccount(userId, googleId, googleEmail),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if googleEmail does not match user email', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId not taken
        .mockResolvedValueOnce({ ...existingUser, email: 'other@example.com' }); // different email

      await expect(
        service.linkGoogleAccount(userId, googleId, googleEmail),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return user unchanged if googleId is already linked to them', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const alreadyLinked = { ...existingUser, googleId: googleId };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId not taken by other user
        .mockResolvedValueOnce(alreadyLinked); // findById

      const result = await service.linkGoogleAccount(
        userId,
        googleId,
        googleEmail,
      );

      expect(result.googleId).toBe(googleId);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should link googleId and return updated user', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // googleId not taken
        .mockResolvedValueOnce(existingUser); // findById
      const updated = { ...existingUser, googleId };
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.linkGoogleAccount(
        userId,
        googleId,
        googleEmail,
      );

      expect(result.googleId).toBe(googleId);
    });

    it('should throw ConflictException on P2002 race condition during update', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['googleId'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(
        service.linkGoogleAccount(userId, googleId, googleEmail),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('linkWalletAddress', () => {
    const userId = 'user-id';
    const wallet = 'addr1qxyz';
    const existingUser = {
      id: userId,
      email: 'u@example.com',
      walletAddress: null,
    } as User;

    it('should throw ConflictException if wallet is already linked to another user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user' }); // wallet lookup

      await expect(service.linkWalletAddress(userId, wallet)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // wallet not taken
        .mockResolvedValueOnce(null); // findById

      await expect(service.linkWalletAddress(userId, wallet)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user unchanged if wallet already linked', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const alreadyLinked = { ...existingUser, walletAddress: wallet };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(alreadyLinked) // wallet lookup — same user
        .mockResolvedValueOnce(alreadyLinked); // findById

      const result = await service.linkWalletAddress(userId, wallet);

      expect(result.walletAddress).toBe(wallet);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should link wallet and return updated user', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // wallet not taken
        .mockResolvedValueOnce(existingUser); // findById
      const updated = { ...existingUser, walletAddress: wallet };
      mockPrismaService.user.update.mockResolvedValue(updated);

      const result = await service.linkWalletAddress(userId, wallet);

      expect(result.walletAddress).toBe(wallet);
    });

    it('should throw ConflictException on P2002 race condition', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingUser);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['walletAddress'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(service.linkWalletAddress(userId, wallet)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findByPin', () => {
    it('should return matching inspector when PIN matches', async () => {
      const bcrypt = await import('bcrypt');
      const plainPin = '123456';
      const hashedPin = await bcrypt.hash(plainPin, 10);
      const inspector = {
        id: 'insp1',
        role: Role.INSPECTOR,
        username: 'insp01',
        pin: hashedPin,
      } as User;

      mockPrismaService.user.findMany.mockResolvedValue([inspector]);

      const result = await service.findByPin(plainPin);

      expect(result).toBeDefined();
      expect(result!.id).toBe('insp1');
    });

    it('should return null when no inspector PIN matches', async () => {
      const bcrypt = await import('bcrypt');
      const hashedPin = await bcrypt.hash('654321', 10);
      const inspector = {
        id: 'insp1',
        role: Role.INSPECTOR,
        username: 'insp01',
        pin: hashedPin,
      } as User;

      mockPrismaService.user.findMany.mockResolvedValue([inspector]);

      const result = await service.findByPin('999999');
      expect(result).toBeNull();
    });

    it('should return null when inspectors have no PIN', async () => {
      const inspector = {
        id: 'insp1',
        role: Role.INSPECTOR,
        username: 'insp01',
        pin: null,
      } as User;
      mockPrismaService.user.findMany.mockResolvedValue([inspector]);

      const result = await service.findByPin('123456');
      expect(result).toBeNull();
    });

    it('should return null when no inspectors exist', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findByPin('123456');
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('createAdminOrSuperAdmin', () => {
    const adminDto = {
      email: 'admin@example.com',
      username: 'adminuser',
      password: 'adminpass',
      role: Role.ADMIN,
    };

    it('should create admin and return user', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const created = {
        id: 'admin-id',
        email: 'adminexample@example.com',
        role: Role.ADMIN,
      };
      mockPrismaService.user.create.mockResolvedValue(created);

      const result = await service.createAdminOrSuperAdmin(adminDto as any);

      expect(result).toEqual(created);
    });

    it('should throw ConflictException when email already taken', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'existing',
      });

      await expect(
        service.createAdminOrSuperAdmin(adminDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when username already taken', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });

      await expect(
        service.createAdminOrSuperAdmin(adminDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on P2002 at DB level', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['email'] },
      });
      mockPrismaService.user.create.mockRejectedValue(conflict);

      await expect(
        service.createAdminOrSuperAdmin(adminDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on general DB error', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAdminOrSuperAdmin(adminDto as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ---------------------------------------------------------------------------
  describe('findAllAdminsAndSuperAdmins', () => {
    it('should return admin and superadmin users', async () => {
      const admins = [
        { id: 'a1', role: Role.ADMIN },
        { id: 'sa1', role: Role.SUPERADMIN },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(admins);

      const result = await service.findAllAdminsAndSuperAdmins();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { role: { in: [Role.ADMIN, Role.SUPERADMIN] } },
        include: { inspectionBranchCity: true },
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockPrismaService.user.findMany.mockRejectedValue(new Error('DB fail'));

      await expect(service.findAllAdminsAndSuperAdmins()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('updateUser — additional branches', () => {
    const id = 'user-id';
    const baseUser = { id, role: Role.CUSTOMER, email: 'u@example.com' };

    it('should throw NotFoundException when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser(id, { name: 'X' } as any, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on P2002 email collision', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['email'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(
        service.updateUser(
          id,
          { email: 'taken@example.com' } as any,
          Role.ADMIN,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on P2002 username collision', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['username'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(
        service.updateUser(id, { username: 'taken' } as any, Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on P2002 walletAddress collision', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['walletAddress'] },
      });
      mockPrismaService.user.update.mockRejectedValue(conflict);

      await expect(
        service.updateUser(id, { walletAddress: 'addr1' } as any, Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on general DB error', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPrismaService.user.update.mockRejectedValue(new Error('DB fail'));

      await expect(
        service.updateUser(id, { name: 'X' } as any, Role.ADMIN),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should hash new pin when provided in dto', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      const updated = { ...baseUser, pin: 'hashedpin' };
      mockPrismaService.user.update.mockResolvedValue(updated);

      await service.updateUser(id, { pin: '123456' } as any, Role.ADMIN);

      const updateCall = mockPrismaService.user.update.mock.calls[0][0];
      expect(typeof updateCall.data.pin).toBe('string');
      expect(updateCall.data.pin).not.toBe('123456');
    });
  });

  // ---------------------------------------------------------------------------
  describe('deleteUser — additional branches', () => {
    const id = 'user-id';
    const baseUser = { id, role: Role.CUSTOMER, email: 'u@example.com' };

    it('should throw NotFoundException when user is not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(id, Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on P2025 during delete', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      const notFound = new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: '0.0.0',
      });
      mockPrismaService.user.delete.mockRejectedValue(notFound);

      await expect(service.deleteUser(id, Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on general DB error', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(baseUser);
      mockPrismaService.user.delete.mockRejectedValue(new Error('DB fail'));

      await expect(service.deleteUser(id, Role.ADMIN)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('findOrCreateByGoogleProfile — ConflictException P2002 path', () => {
    it('should throw ConflictException on P2002 during upsert', async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '0.0.0',
        meta: { target: ['googleId'] },
      });
      mockPrismaService.user.upsert.mockRejectedValue(conflict);

      await expect(
        service.findOrCreateByGoogleProfile({
          id: 'google-id',
          emails: [{ value: 'test@gmail.com' }],
          displayName: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
