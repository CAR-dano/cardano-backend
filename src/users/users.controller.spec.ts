/**
 * @fileoverview This file contains unit tests for the UsersController.
 * It tests the controller's methods for managing users (findAll, findOne, updateUserRole, etc.),
 * ensuring they correctly interact with the mocked UsersService and apply appropriate
 * authorization guards (JwtAuthGuard, RolesGuard) and decorators (@Roles).
 * Dependencies are mocked to test the controller logic in isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Needed for mocking
import { RolesGuard } from '../auth/guards/roles.guard'; // Needed for mocking
import { Role, User } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core'; // Reflector is needed by RolesGuard

// --- Mock Dependencies ---

/**
 * Mock object for UsersService.
 * Provides Jest mock functions for all methods called by UsersController.
 */
const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  updateRole: jest.fn(),
};

/**
 * Mock implementation for JwtAuthGuard.
 * For unit tests, we typically assume the user is authenticated if the guard is applied.
 * It might attach a mock user to the request if needed by RolesGuard.
 */
const mockJwtAuthGuard = {
  canActivate: jest.fn().mockImplementation((context) => {
    // Simulate attaching a user for RolesGuard to check (optional, depends on RolesGuard implementation)
    // const request = context.switchToHttp().getRequest();
    // request.user = { id: 'mock-user-id', role: Role.ADMIN }; // Example mock user
    return true; // Assume authentication passes for controller logic tests
  }),
};

/**
 * Mock implementation for RolesGuard.
 * For unit tests, we can mock it to always return true, assuming role checks
 * are tested elsewhere (like E2E tests or RolesGuard's own unit tests).
 * Or, we could make it check mock roles attached by mockJwtAuthGuard if needed.
 */
const mockRolesGuard = {
  canActivate: jest.fn(() => true), // Simplest mock: always allow
};

/**
 * Test suite for the UsersController class.
 */
describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  /**
   * Sets up the NestJS testing module before each test case.
   * Provides the UsersController and mocked versions of its dependencies.
   * Overrides the actual guards with mocks to isolate controller logic.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController], // The controller under test
      providers: [
        { provide: UsersService, useValue: mockUsersService }, // Provide the mock service
        // Reflector is usually provided automatically by NestJS core when needed by guards/interceptors
      ],
    })
      // Override the actual guards with simplified mocks for unit testing
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService); // Get the mock instance

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  /**
   * Basic test to ensure the controller instance is created correctly.
   */
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /**
   * Test suite for the `findAll` method (GET /admin/users).
   */
  describe('findAll', () => {
    const mockUserList: any[] = [
      // Use 'any' or create a partial User type for testing
      {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin',
        role: Role.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      {
        id: '2',
        email: 'cust@test.com',
        name: 'Customer',
        role: Role.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ];
    // Expected result after mapping to DTO
    const mockUserResponseList = mockUserList.map(
      (u) => new UserResponseDto(u as User),
    );

    /**
     * Tests the successful retrieval of all users.
     * Expects usersService.findAll to be called and the result to be mapped to UserResponseDto.
     */
    it('should return an array of users mapped to UserResponseDto', async () => {
      // Arrange: Mock service to return a list of users
      mockUsersService.findAll.mockResolvedValue(mockUserList);

      // Act: Call the controller method with a role
      const result = await controller.findAll(Role.ADMIN);

      // Assert: Check service call and result structure/content
      expect(usersService.findAll).toHaveBeenCalledWith(Role.ADMIN);
      expect(result).toEqual(mockUserResponseList);
      expect(result[0]).toBeInstanceOf(UserResponseDto); // Ensure DTO mapping occurred
    });

    /**
     * Tests error handling if the service fails.
     */
    it('should throw an error if usersService.findAll fails', async () => {
      // Arrange: Mock service to throw an error
      const serviceError = new InternalServerErrorException('DB Error');
      mockUsersService.findAll.mockRejectedValue(serviceError);

      // Act & Assert: Expect the controller call to reject with the same error
      await expect(controller.findAll(Role.ADMIN)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  /**
   * Test suite for the `findOne` method (GET /admin/users/:id).
   */
  describe('findOne', () => {
    const testId = 'test-uuid-1';
    const mockUser: User = {
      id: testId,
      email: 'findone@test.com',
      name: 'Find Me',
      googleId: null,
      role: Role.REVIEWER,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const mockUserResponse = new UserResponseDto(mockUser);

    /**
     * Tests successful retrieval of a user by ID.
     * Expects usersService.findById to be called with the ID and the result mapped to DTO.
     */
    it('should return a single user mapped to UserResponseDto if found', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findOne(testId, Role.ADMIN);

      // Assert
      expect(usersService.findById).toHaveBeenCalledWith(testId);
      expect(result).toEqual(mockUserResponse);
    });

    it('should throw NotFoundException if an ADMIN tries to access a SUPERADMIN', async () => {
      const superAdminUser = { ...mockUser, role: Role.SUPERADMIN };
      mockUsersService.findById.mockResolvedValue(superAdminUser);

      await expect(controller.findOne(testId, Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow a SUPERADMIN to access another SUPERADMIN', async () => {
      const superAdminUser = { ...mockUser, role: Role.SUPERADMIN };
      mockUsersService.findById.mockResolvedValue(superAdminUser);

      const result = await controller.findOne(testId, Role.SUPERADMIN);

      expect(result.role).toBe(Role.SUPERADMIN);
    });

    /**
     * Tests the scenario where the user with the given ID is not found.
     * Expects usersService.findById to be called and a NotFoundException to be thrown by the controller.
     */
    it('should throw NotFoundException if user is not found', async () => {
      // Arrange: Mock service to return null
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert: Expect the controller call to reject with NotFoundException
      await expect(controller.findOne(testId, Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * Tests error handling if the service fails.
     */
    it('should throw an error if usersService.findById fails', async () => {
      // Arrange
      const serviceError = new InternalServerErrorException('DB Error');
      mockUsersService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(testId, Role.ADMIN)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  /**
   * Test suite for the `updateUser` method.
   */
  describe('updateUser', () => {
    const testId = 'test-id';
    const updateDto = { name: 'New Name' };

    it('should call usersService.updateUser with correct params', async () => {
      mockUsersService.updateUser.mockResolvedValue({ id: testId, ...updateDto });

      await controller.updateUser(testId, updateDto as any, Role.ADMIN);

      expect(usersService.updateUser).toHaveBeenCalledWith(
        testId,
        updateDto,
        Role.ADMIN,
      );
    });
  });

  /**
   * Test suite for the `deleteUser` method.
   */
  describe('deleteUser', () => {
    const testId = 'test-id';

    it('should call usersService.deleteUser with correct params', async () => {
      mockUsersService.deleteUser.mockResolvedValue(undefined);

      await controller.deleteUser(testId, Role.ADMIN);

      expect(usersService.deleteUser).toHaveBeenCalledWith(testId, Role.ADMIN);
    });
  });
});
