/**
 * @fileoverview Unit tests for the UsersController.
 * Tests all methods for managing users, ensuring they correctly interact
 * with the mocked UsersService and return proper DTOs.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, User } from '@prisma/client';
import { UserResponseDto } from './dto/user-response.dto';
import { InspectorResponseDto } from './dto/inspector-response.dto';
import { GeneratePinResponseDto } from './dto/generate-pin-response.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

// --- Mock Dependencies ---

const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  updateRole: jest.fn(),
  findAllInspectors: jest.fn(),
  findAllAdminsAndSuperAdmins: jest.fn(),
  createAdminOrSuperAdmin: jest.fn(),
  createInspector: jest.fn(),
  updateInspector: jest.fn(),
  generatePin: jest.fn(),
};

const mockJwtAuthGuard = {
  canActivate: jest.fn(() => true),
};

const mockRolesGuard = {
  canActivate: jest.fn(() => true),
};

// Reusable base user entity
const baseUser: User = {
  id: 'user-uuid-1',
  email: 'user@test.com',
  username: 'testuser',
  name: 'Test User',
  role: Role.ADMIN,
  isActive: true,
  walletAddress: null,
  whatsappNumber: null,
  password: 'hashed',
  googleId: null,
  hashedRefreshToken: null,
  sessionVersion: 1,
  pinHash: null,
  inspectionBranchCityId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const baseInspector: User = {
  ...baseUser,
  id: 'inspector-uuid-1',
  role: Role.INSPECTOR,
  email: 'inspector@test.com',
  username: 'inspector1',
} as any;

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return an array of users mapped to UserResponseDto', async () => {
      mockUsersService.findAll.mockResolvedValue([baseUser]);

      const result = await controller.findAll(Role.ADMIN);

      expect(usersService.findAll).toHaveBeenCalledWith(Role.ADMIN);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
    });

    it('should return empty array when no users exist', async () => {
      mockUsersService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(Role.SUPERADMIN);

      expect(result).toEqual([]);
    });

    it('should propagate errors from usersService.findAll', async () => {
      mockUsersService.findAll.mockRejectedValue(
        new InternalServerErrorException('DB Error'),
      );

      await expect(controller.findAll(Role.ADMIN)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAllInspectors
  // ---------------------------------------------------------------------------
  describe('findAllInspectors', () => {
    it('should return array of inspector users mapped to UserResponseDto', async () => {
      mockUsersService.findAllInspectors.mockResolvedValue([baseInspector]);

      const result = await controller.findAllInspectors();

      expect(usersService.findAllInspectors).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
      expect(result[0].role).toBe(Role.INSPECTOR);
    });

    it('should return empty array when no inspectors found', async () => {
      mockUsersService.findAllInspectors.mockResolvedValue([]);

      const result = await controller.findAllInspectors();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findAllAdminsAndSuperAdmins
  // ---------------------------------------------------------------------------
  describe('findAllAdminsAndSuperAdmins', () => {
    const superAdmin = {
      ...baseUser,
      id: 'super-uuid',
      role: Role.SUPERADMIN,
    } as any;

    it('should return array of admin and superadmin users', async () => {
      mockUsersService.findAllAdminsAndSuperAdmins.mockResolvedValue([
        baseUser,
        superAdmin,
      ]);

      const result = await controller.findAllAdminsAndSuperAdmins();

      expect(usersService.findAllAdminsAndSuperAdmins).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
    });

    it('should return empty array when no admins found', async () => {
      mockUsersService.findAllAdminsAndSuperAdmins.mockResolvedValue([]);

      const result = await controller.findAllAdminsAndSuperAdmins();

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return UserResponseDto when user is found', async () => {
      mockUsersService.findById.mockResolvedValue(baseUser);

      const result = await controller.findOne(baseUser.id, Role.ADMIN);

      expect(usersService.findById).toHaveBeenCalledWith(baseUser.id);
      expect(result).toBeInstanceOf(UserResponseDto);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        controller.findOne('non-existent', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when ADMIN tries to view a SUPERADMIN', async () => {
      const superAdmin = { ...baseUser, role: Role.SUPERADMIN };
      mockUsersService.findById.mockResolvedValue(superAdmin);

      await expect(controller.findOne(baseUser.id, Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow SUPERADMIN to view another SUPERADMIN', async () => {
      const superAdmin = { ...baseUser, role: Role.SUPERADMIN };
      mockUsersService.findById.mockResolvedValue(superAdmin);

      const result = await controller.findOne(baseUser.id, Role.SUPERADMIN);

      expect(result.role).toBe(Role.SUPERADMIN);
    });

    it('should propagate errors from usersService.findById', async () => {
      mockUsersService.findById.mockRejectedValue(
        new InternalServerErrorException('DB Error'),
      );

      await expect(controller.findOne(baseUser.id, Role.ADMIN)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // createAdminOrSuperAdmin
  // ---------------------------------------------------------------------------
  describe('createAdminOrSuperAdmin', () => {
    const createAdminDto = {
      email: 'newadmin@test.com',
      username: 'newadmin',
      password: 'P@ssword1',
      role: Role.ADMIN,
    };

    it('should call usersService.createAdminOrSuperAdmin and return UserResponseDto', async () => {
      const createdUser = { ...baseUser, email: createAdminDto.email };
      mockUsersService.createAdminOrSuperAdmin.mockResolvedValue(createdUser);

      const result = await controller.createAdminOrSuperAdmin(
        createAdminDto as any,
      );

      expect(usersService.createAdminOrSuperAdmin).toHaveBeenCalledWith(
        createAdminDto,
      );
      expect(result).toBeInstanceOf(UserResponseDto);
    });

    it('should propagate errors from usersService.createAdminOrSuperAdmin', async () => {
      mockUsersService.createAdminOrSuperAdmin.mockRejectedValue(
        new Error('Conflict'),
      );

      await expect(
        controller.createAdminOrSuperAdmin(createAdminDto as any),
      ).rejects.toThrow('Conflict');
    });
  });

  // ---------------------------------------------------------------------------
  // updateUserRole
  // ---------------------------------------------------------------------------
  describe('updateUserRole', () => {
    const updateRoleDto = { role: Role.REVIEWER };
    const actingUserId = 'acting-user-id';

    it('should call usersService.updateRole and return UserResponseDto', async () => {
      const updatedUser = { ...baseUser, role: Role.REVIEWER };
      mockUsersService.updateRole.mockResolvedValue(updatedUser);

      const result = await controller.updateUserRole(
        baseUser.id,
        updateRoleDto as any,
        actingUserId,
        Role.SUPERADMIN,
      );

      expect(usersService.updateRole).toHaveBeenCalledWith(
        baseUser.id,
        Role.REVIEWER,
        actingUserId,
        Role.SUPERADMIN,
      );
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.role).toBe(Role.REVIEWER);
    });

    it('should propagate NotFoundException from usersService.updateRole', async () => {
      mockUsersService.updateRole.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.updateUserRole(
          baseUser.id,
          updateRoleDto as any,
          actingUserId,
          Role.ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // createInspector
  // ---------------------------------------------------------------------------
  describe('createInspector', () => {
    const createInspectorDto = {
      username: 'newinspector',
      name: 'New Inspector',
      inspectionBranchCityId: 'branch-id',
    };

    it('should call usersService.createInspector and return InspectorResponseDto with PIN', async () => {
      const returnVal = { ...baseInspector, plainPin: '123456' };
      mockUsersService.createInspector.mockResolvedValue(returnVal);

      const result = await controller.createInspector(
        createInspectorDto as any,
      );

      expect(usersService.createInspector).toHaveBeenCalledWith(
        createInspectorDto,
      );
      expect(result).toBeInstanceOf(InspectorResponseDto);
      expect(result.pin).toBe('123456');
    });

    it('should propagate errors from usersService.createInspector', async () => {
      mockUsersService.createInspector.mockRejectedValue(new Error('Conflict'));

      await expect(
        controller.createInspector(createInspectorDto as any),
      ).rejects.toThrow('Conflict');
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------
  describe('updateUser', () => {
    const updateDto = { name: 'Updated Name' };

    it('should call usersService.updateUser and return UserResponseDto', async () => {
      const updatedUser = { ...baseUser, name: 'Updated Name' };
      mockUsersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateUser(
        baseUser.id,
        updateDto as any,
        Role.ADMIN,
      );

      expect(usersService.updateUser).toHaveBeenCalledWith(
        baseUser.id,
        updateDto,
        Role.ADMIN,
      );
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.name).toBe('Updated Name');
    });

    it('should propagate errors from usersService.updateUser', async () => {
      mockUsersService.updateUser.mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(
        controller.updateUser(baseUser.id, updateDto as any, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateInspector
  // ---------------------------------------------------------------------------
  describe('updateInspector', () => {
    const updateInspectorDto = { name: 'Updated Inspector' };

    it('should call usersService.updateInspector and return UserResponseDto', async () => {
      const updatedInspector = { ...baseInspector, name: 'Updated Inspector' };
      mockUsersService.updateInspector.mockResolvedValue(updatedInspector);

      const result = await controller.updateInspector(
        baseInspector.id,
        updateInspectorDto as any,
      );

      expect(usersService.updateInspector).toHaveBeenCalledWith(
        baseInspector.id,
        updateInspectorDto,
      );
      expect(result).toBeInstanceOf(UserResponseDto);
    });

    it('should propagate NotFoundException from usersService.updateInspector', async () => {
      mockUsersService.updateInspector.mockRejectedValue(
        new NotFoundException('Inspector not found'),
      );

      await expect(
        controller.updateInspector(baseInspector.id, updateInspectorDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // generatePin
  // ---------------------------------------------------------------------------
  describe('generatePin', () => {
    it('should call usersService.generatePin and return GeneratePinResponseDto', async () => {
      const returnVal = { ...baseInspector, plainPin: '654321' };
      mockUsersService.generatePin.mockResolvedValue(returnVal);

      const result = await controller.generatePin(baseInspector.id);

      expect(usersService.generatePin).toHaveBeenCalledWith(baseInspector.id);
      expect(result).toBeInstanceOf(GeneratePinResponseDto);
      expect(result.pin).toBe('654321');
    });

    it('should propagate NotFoundException from usersService.generatePin', async () => {
      mockUsersService.generatePin.mockRejectedValue(
        new NotFoundException('Inspector not found'),
      );

      await expect(controller.generatePin(baseInspector.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteUser
  // ---------------------------------------------------------------------------
  describe('deleteUser', () => {
    it('should call usersService.deleteUser with correct params', async () => {
      mockUsersService.deleteUser.mockResolvedValue(undefined);

      await controller.deleteUser(baseUser.id, Role.ADMIN);

      expect(usersService.deleteUser).toHaveBeenCalledWith(
        baseUser.id,
        Role.ADMIN,
      );
    });

    it('should propagate NotFoundException from usersService.deleteUser', async () => {
      mockUsersService.deleteUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.deleteUser(baseUser.id, Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
