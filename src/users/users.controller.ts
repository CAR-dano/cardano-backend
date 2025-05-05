/**
 * @fileoverview Controller for admin-level user management operations.
 * All endpoints require authentication (JWT) and ADMIN role authorization.
 */

import {
  Controller,
  Get,
  Param,
  Put,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  Delete, // Add Delete
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // JWT authentication
import { RolesGuard } from '../auth/guards/roles.guard'; // Role-based authorization
import { Roles } from '../auth/decorators/roles.decorator'; // Decorator to specify allowed roles
import { Role } from '@prisma/client'; // Role enum
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto'; // DTO for API responses
import { UpdateUserRoleDto } from './dto/update-user-role.dto'; // DTO for updating role

@ApiTags('User Management (Admin)') // Tag for documentation
@ApiBearerAuth('JwtAuthGuard') // Indicate JWT is needed for all endpoints here
@UseGuards(JwtAuthGuard, RolesGuard) // Apply both guards at the controller level
@Controller('admin/users') // Base path: /api/v1/admin/users
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.log('UsersController initialized (Admin)');
  }

  /**
   * Retrieves a list of all users. Requires ADMIN role.
   */
  @Get()
  @Roles(Role.ADMIN) // Only ADMINs can access this
  @ApiOperation({ summary: 'Retrieve all users (Admin Only)' })
  @ApiResponse({
    status: 200,
    description: 'List of users.',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden (Requires ADMIN role).' })
  async findAll(): Promise<UserResponseDto[]> {
    this.logger.log(`Admin request: findAll users`);
    const users = await this.usersService.findAll();
    return users.map((user) => new UserResponseDto(user)); // Map to safe DTO
  }

  /**
   * Retrieves details for a specific user by ID. Requires ADMIN role.
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Retrieve user by ID (Admin Only)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User details.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: findOne user by ID: ${id}`);
    // Service's findById returns null if not found, controller should handle 404
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return new UserResponseDto(user);
  }

  /**
   * Updates the role of a specific user. Requires ADMIN role.
   */
  @Put(':id/role') // Using PUT as role is a specific resource attribute being replaced
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user role (Admin Only)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
  })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiResponse({
    status: 200,
    description: 'User role updated.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid role provided.' })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    this.logger.log(
      `Admin request: update role for user ${id} to ${updateUserRoleDto.role}`,
    );
    // Service handles NotFoundException if user doesn't exist
    const updatedUser = await this.usersService.updateRole(
      id,
      updateUserRoleDto.role,
    );
    return new UserResponseDto(updatedUser);
  }

  /**
   * Disables a user account. Requires ADMIN role.
   * (Assumes 'setStatus' method and 'isActive' field exist).
   */
  @Put(':id/disable') // Using PUT to set a specific state
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable user account (Admin Only)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User disabled.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async disableUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: disable user ${id}`);
    const user = await this.usersService.setStatus(id, false); // Pass false to disable
    return new UserResponseDto(user);
  }

  /**
   * Enables a user account. Requires ADMIN role.
   * (Assumes 'setStatus' method and 'isActive' field exist).
   */
  @Put(':id/enable') // Using PUT to set a specific state
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable user account (Admin Only)' })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'User enabled.',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  async enableUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: enable user ${id}`);
    const user = await this.usersService.setStatus(id, true); // Pass true to enable
    return new UserResponseDto(user);
  }

  // Optional: Add DELETE endpoint if needed
  /*
   @Delete(':id')
   @Roles(Role.ADMIN)
   @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful DELETE
   @ApiOperation({ summary: 'Delete a user (Admin Only) - Use with caution!'})
   @ApiParam({ name: 'id', type: String, format: 'uuid' })
   @ApiResponse({ status: 204, description: 'User deleted.'})
   @ApiResponse({ status: 401 }) @ApiResponse({ status: 403 }) @ApiResponse({ status: 404 })
   async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
       this.logger.warn(`Admin request: DELETE user ${id}`);
       await this.usersService.deleteUser(id); // Assumes deleteUser method exists in service
   }
   */
}
