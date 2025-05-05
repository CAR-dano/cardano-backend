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
  updateRole: jest.fn(),
  setStatus: jest.fn(),
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
      },
      {
        id: '2',
        email: 'cust@test.com',
        name: 'Customer',
        role: Role.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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

      // Act: Call the controller method
      const result = await controller.findAll();

      // Assert: Check service call and result structure/content
      expect(usersService.findAll).toHaveBeenCalledTimes(1);
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
      await expect(controller.findAll()).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(usersService.findAll).toHaveBeenCalledTimes(1);
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
    };
    const mockUserResponse = new UserResponseDto(mockUser);

    /**
     * Tests successful retrieval of a user by ID.
     * Expects usersService.findById to be called with the ID and the result mapped to DTO.
     */
    it('should return a single user mapped to UserResponseDto if found', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findOne(testId);

      // Assert
      expect(usersService.findById).toHaveBeenCalledWith(testId);
      expect(usersService.findById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });

    /**
     * Tests the scenario where the user with the given ID is not found.
     * Expects usersService.findById to be called and a NotFoundException to be thrown by the controller.
     */
    it('should throw NotFoundException if user is not found', async () => {
      // Arrange: Mock service to return null
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert: Expect the controller call to reject with NotFoundException
      await expect(controller.findOne(testId)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(testId);
      expect(usersService.findById).toHaveBeenCalledTimes(1);
    });

    /**
     * Tests error handling if the service fails.
     */
    it('should throw an error if usersService.findById fails', async () => {
      // Arrange
      const serviceError = new InternalServerErrorException('DB Error');
      mockUsersService.findById.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.findOne(testId)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(testId);
    });
  });

  /**
   * Test suite for the `updateUserRole` method (PUT /admin/users/:id/role).
   */
  describe('updateUserRole', () => {
    const testId = 'test-uuid-2';
    const updateDto: UpdateUserRoleDto = { role: Role.ADMIN };
    const mockUpdatedUser: User = {
      id: testId,
      email: 'updated@test.com',
      name: 'Updated Role',
      googleId: null,
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockUpdatedResponse = new UserResponseDto(mockUpdatedUser);

    /**
     * Tests successful role update.
     * Expects usersService.updateRole to be called with ID and new role from DTO,
     * and the result mapped to DTO.
     */
    it('should update user role and return updated user as DTO', async () => {
      // Arrange
      mockUsersService.updateRole.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await controller.updateUserRole(testId, updateDto);

      // Assert
      expect(usersService.updateRole).toHaveBeenCalledWith(
        testId,
        updateDto.role,
      );
      expect(usersService.updateRole).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUpdatedResponse);
      expect(result).toBeInstanceOf(UserResponseDto);
    });

    /**
     * Tests the scenario where the user to update is not found by the service.
     * Expects usersService.updateRole to be called and the controller to propagate
     * the NotFoundException thrown by the service.
     */
    it('should throw NotFoundException if user to update is not found', async () => {
      // Arrange: Mock service to throw NotFoundException
      mockUsersService.updateRole.mockRejectedValue(
        new NotFoundException(`User not found`),
      );

      // Act & Assert
      await expect(
        controller.updateUserRole(testId, updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(usersService.updateRole).toHaveBeenCalledWith(
        testId,
        updateDto.role,
      );
    });

    /**
     * Tests error handling if the service fails during update.
     */
    it('should throw an error if usersService.updateRole fails', async () => {
      // Arrange
      const serviceError = new InternalServerErrorException('DB Update Error');
      mockUsersService.updateRole.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(
        controller.updateUserRole(testId, updateDto),
      ).rejects.toThrow(InternalServerErrorException);
      expect(usersService.updateRole).toHaveBeenCalledWith(
        testId,
        updateDto.role,
      );
    });
  });

  /**
   * Test suite for the `disableUser` method (PUT /admin/users/:id/disable).
   * Assumes UsersService has a `setStatus` method.
   */
  describe('disableUser', () => {
    const testId = 'test-uuid-3';
    // Assume setStatus returns the user with isActive=false (if model has it)
    const mockDisabledUser: User = {
      id: testId,
      email: 'disabled@test.com',
      name: 'Disabled User',
      googleId: null,
      role: Role.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
      // isActive: false, // Add this if your model has it
    };
    const mockDisabledResponse = new UserResponseDto(mockDisabledUser);

    /**
     * Tests successful user disabling.
     * Expects usersService.setStatus to be called with ID and `false`.
     */
    it('should disable user and return updated user as DTO', async () => {
      // Arrange
      mockUsersService.setStatus.mockResolvedValue(mockDisabledUser);

      // Act
      const result = await controller.disableUser(testId);

      // Assert
      expect(usersService.setStatus).toHaveBeenCalledWith(testId, false);
      expect(usersService.setStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDisabledResponse); // Or match structure if isActive not present
    });

    /**
     * Tests scenario where user to disable is not found.
     */
    it('should throw NotFoundException if user to disable is not found', async () => {
      // Arrange
      mockUsersService.setStatus.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // Act & Assert
      await expect(controller.disableUser(testId)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.setStatus).toHaveBeenCalledWith(testId, false);
    });
  });

  /**
   * Test suite for the `enableUser` method (PUT /admin/users/:id/enable).
   * Assumes UsersService has a `setStatus` method.
   */
  describe('enableUser', () => {
    const testId = 'test-uuid-4';
    // Assume setStatus returns the user with isActive=true (if model has it)
    const mockEnabledUser: User = {
      id: testId,
      email: 'enabled@test.com',
      name: 'Enabled User',
      googleId: null,
      role: Role.CUSTOMER,
      createdAt: new Date(),
      updatedAt: new Date(),
      // isActive: true, // Add this if your model has it
    };
    const mockEnabledResponse = new UserResponseDto(mockEnabledUser);

    /**
     * Tests successful user enabling.
     * Expects usersService.setStatus to be called with ID and `true`.
     */
    it('should enable user and return updated user as DTO', async () => {
      // Arrange
      mockUsersService.setStatus.mockResolvedValue(mockEnabledUser);

      // Act
      const result = await controller.enableUser(testId);

      // Assert
      expect(usersService.setStatus).toHaveBeenCalledWith(testId, true);
      expect(usersService.setStatus).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockEnabledResponse); // Or match structure if isActive not present
    });

    /**
     * Tests scenario where user to enable is not found.
     */
    it('should throw NotFoundException if user to enable is not found', async () => {
      // Arrange
      mockUsersService.setStatus.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // Act & Assert
      await expect(controller.enableUser(testId)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.setStatus).toHaveBeenCalledWith(testId, true);
    });
  });
});
