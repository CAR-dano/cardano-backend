/*
 * --------------------------------------------------------------------------
 * File: users.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for managing user-related operations,
 * specifically focusing on admin-level functionalities. It handles API
 * endpoints for retrieving, updating, creating, and deleting user accounts,
 * including specific endpoints for managing inspector users. All endpoints
 * within this controller are protected by JWT authentication and require
 * the ADMIN role for access.
 * --------------------------------------------------------------------------
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
  Post, // Import Post
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
import { CreateInspectorDto } from './dto/create-inspector.dto'; // Import CreateInspectorDto
import { InspectorResponseDto } from './dto/inspector-response.dto';
import { GeneratePinResponseDto } from './dto/generate-pin-response.dto';
import { UpdateUserDto } from './dto/update-user.dto'; // Import UpdateUserDto
import { UpdateInspectorDto } from './dto/update-inspector.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('User Management (Admin)') // Tag for documentation
@ApiBearerAuth('JwtAuthGuard') // Indicate JWT is needed for all endpoints here
@UseGuards(JwtAuthGuard, RolesGuard) // Apply both guards at the controller level
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('admin/users') // Base path: /api/v1/admin/users
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.log('UsersController initialized (Admin)');
  }

  /**
   * Retrieves a list of all users.
   * Requires ADMIN role.
   *
   * @returns A promise that resolves to an array of UserResponseDto.
   */
  @Get()
  @Roles(Role.ADMIN) // Only ADMINs can access this
  @ApiOperation({
    summary: 'Retrieve all users (Admin Only)',
    description:
      'Fetches a list of all user accounts in the system. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users.',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  async findAll(): Promise<UserResponseDto[]> {
    this.logger.log(`Admin request: findAll users`);
    const users = await this.usersService.findAll();
    return users.map((user) => new UserResponseDto(user)); // Map to safe DTO
  }

  /**
   * Retrieves a list of all inspector users.
   * Requires ADMIN role.
   *
   * @returns A promise that resolves to an array of UserResponseDto.
   */
  @Get('inspectors') // Specific endpoint for finding all inspectors
  @Roles(Role.ADMIN) // Only ADMINs can access this
  @ApiOperation({
    summary: 'Retrieve all inspector users',
    description:
      'Fetches a list of all user accounts specifically designated as inspectors.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of inspector users.',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  async findAllInspectors(): Promise<UserResponseDto[]> {
    this.logger.log(`findAllInspectors users`);
    const users = await this.usersService.findAllInspectors();
    return users.map((user) => new UserResponseDto(user)); // Map to safe DTO
  }

  /**
   * Retrieves details for a specific user by ID.
   * Requires ADMIN role.
   *
   * @param id The UUID of the user.
   * @returns A promise that resolves to a UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found.
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Retrieve user by ID (Admin Only)',
    description:
      'Fetches the details of a specific user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'User details.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
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
   * Updates the role of a specific user.
   * Requires ADMIN role.
   *
   * @param id The UUID of the user.
   * @param updateUserRoleDto The DTO containing the new role.
   * @returns A promise that resolves to the updated UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found.
   */
  @Put(':id/role') // Using PUT as role is a specific resource attribute being replaced
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user role (Admin Only)',
    description:
      'Updates the role of a specific user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiBody({
    type: UpdateUserRoleDto,
    description: 'The new role to assign to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid role provided in the request body.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
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
   * Disables a user account.
   * Requires ADMIN role.
   * Assumes 'setStatus' method and 'isActive' field exist in the service.
   *
   * @param id The UUID of the user to disable.
   * @returns A promise that resolves to the updated UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found.
   */
  @Put(':id/disable') // Using PUT to set a specific state
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Disable user account (Admin Only)',
    description:
      'Disables a user account, preventing the user from logging in. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'User disabled.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
  async disableUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: disable user ${id}`);
    const user = await this.usersService.setStatus(id, false); // Pass false to disable
    return new UserResponseDto(user);
  }

  /**
   * Enables a user account.
   * Requires ADMIN role.
   * Assumes 'setStatus' method and 'isActive' field exist in the service.
   *
   * @param id The UUID of the user to enable.
   * @returns A promise that resolves to the updated UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found.
   */
  @Put(':id/enable') // Using PUT to set a specific state
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enable user account (Admin Only)',
    description:
      'Enables a disabled user account, allowing the user to log in again. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'User enabled.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
  async enableUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: enable user ${id}`);
    const user = await this.usersService.setStatus(id, true); // Pass true to enable
    return new UserResponseDto(user);
  }

  /**
   * Creates a new user with the 'INSPECTOR' role.
   * This endpoint is restricted to users with the 'ADMIN' role.
   *
   * @param createInspectorDto - DTO containing the new inspector's details.
   * @returns {Promise<InspectorResponseDto>} The created inspector's profile, including the generated PIN.
   */
  @Post('inspector')
  @Roles(Role.ADMIN) // Only ADMINs can access this
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new inspector user (Admin only)' })
  @ApiBody({
    type: CreateInspectorDto,
    description: 'Details for the new inspector user.',
  })
  @ApiResponse({
    status: 201,
    description:
      'The inspector has been successfully created, including the generated PIN.',
    type: InspectorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data provided for the new inspector.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict (email/username exists).',
  })
  async createInspector(
    @Body() createInspectorDto: CreateInspectorDto,
  ): Promise<InspectorResponseDto> {
    this.logger.log(
      `Admin request to create inspector: ${createInspectorDto.username}`,
    );
    const { plainPin, ...newUser } =
      await this.usersService.createInspector(createInspectorDto);
    return new InspectorResponseDto(newUser, plainPin);
  }

  /**
   * Updates details for a specific user (including inspectors).
   * Requires ADMIN role.
   *
   * @param id The UUID of the user to update.
   * @param updateUserDto The DTO containing the updated user details.
   * @returns A promise that resolves to the updated UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found.
   * @throws ConflictException if a user with the provided email, username, or wallet address already exists.
   */
  @Put(':id') // General PUT endpoint for user updates
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user details (Admin Only)',
    description:
      'Updates the details of an existing user account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiBody({ type: UpdateUserDto, description: 'The updated user details.' })
  @ApiResponse({
    status: 200,
    description: 'User details updated.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data provided for the user update.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
  @ApiResponse({
    status: 409,
    description:
      'A user with the provided email, username, or wallet address already exists.',
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: updateUser ID: ${id}`);
    const updatedUser = await this.usersService.updateUser(id, updateUserDto);
    return new UserResponseDto(updatedUser);
  }

  /**
   * Updates details for a specific inspector.
   * Requires ADMIN role.
   *
   * @param id The UUID of the user to update.
   * @param updateInspectorDto The DTO containing the updated inspector details.
   * @returns A promise that resolves to the updated UserResponseDto.
   * @throws NotFoundException if the user with the specified ID is not found or is not an inspector.
   * @throws ConflictException if a user with the provided email or username already exists.
   */
  @Put('inspector/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update inspector details (Admin Only)',
    description:
      'Updates the details of an existing inspector account using their unique UUID. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiBody({
    type: UpdateInspectorDto,
    description: 'The updated inspector details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Inspector details updated.',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data provided for the inspector update.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'Inspector with the specified ID not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'A user with the provided email or username already exists.',
  })
  async updateInspector(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInspectorDto: UpdateInspectorDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Admin request: updateInspector ID: ${id}`);
    const updatedUser = await this.usersService.updateInspector(
      id,
      updateInspectorDto,
    );
    return new UserResponseDto(updatedUser);
  }

  /**
   * Generates a new PIN for a specific inspector.
   * Requires ADMIN role.
   *
   * @param id The UUID of the inspector.
   * @returns A promise that resolves to the inspector's data and the new PIN.
   * @throws NotFoundException if the user with the specified ID is not found or is not an inspector.
   */
  @Post('inspector/:id/generate-pin')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a new PIN for an inspector (Admin Only)',
    description:
      'Generates a new unique PIN for an existing inspector account. This endpoint is restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'PIN generated successfully.',
    type: GeneratePinResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'Inspector with the specified ID not found.',
  })
  async generatePin(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GeneratePinResponseDto> {
    this.logger.log(`Admin request: generatePin for inspector ID: ${id}`);
    const { plainPin, ...user } = await this.usersService.generatePin(id);
    return new GeneratePinResponseDto(user, plainPin);
  }

  /**
   * Deletes a user by ID.
   * Requires ADMIN role.
   *
   * @param id The UUID of the user to delete.
   * @returns A promise that resolves when the user is successfully deleted.
   * @throws NotFoundException if the user with the specified ID is not found.
   */
  @Delete(':id') // DELETE endpoint for deleting users
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful DELETE
  @ApiOperation({
    summary: 'Delete a user (Admin Only) - Use with caution!',
    description:
      'Deletes a user account using their unique UUID. This action is irreversible and restricted to users with the ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'User UUID',
    type: String,
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({ status: 204, description: 'User deleted.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Authentication token is missing or invalid.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the necessary ADMIN role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User with the specified ID not found.',
  })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    this.logger.warn(`Admin request: DELETE user ${id}`);
    await this.usersService.deleteUser(id);
  }
}
