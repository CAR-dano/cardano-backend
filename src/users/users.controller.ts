/**
 * @fileoverview Controller responsible for handling user management operations,
 * typically performed by administrators. All endpoints within this controller
 * are protected and require ADMIN role authorization.
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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client'; // Assuming Role enum is from Prisma
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto'; // Example DTO for user response
import { UpdateUserRoleDto } from './dto/update-user-role.dto'; // DTO for updating role

@ApiTags('User Management') // Group endpoints under 'User Management' in API docs
@ApiBearerAuth('JwtAuthGuard') // Indicate all routes need JWT Bearer token
@UseGuards(JwtAuthGuard, RolesGuard) // Apply JWT and Role guards to all routes in this controller
@Controller('admin/users') // Base path for this controller: /api/v1/admin/users
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  /**
   * Injects the UsersService to interact with user data.
   * @param {UsersService} usersService - The service for user operations.
   */
  constructor(private readonly usersService: UsersService) {
    this.logger.log('UsersController initialized');
  }

  /**
   * Retrieves a list of all users.
   * Requires ADMIN role.
   * @returns {Promise<UserResponseDto[]>} A list of users (potentially paginated in a real app).
   */
  @Get()
  @Roles(Role.ADMIN) // Specify that only ADMINs can access this endpoint
  @ApiOperation({ summary: 'Retrieve all users (Admin Only)' })
  @ApiResponse({ status: 200, description: 'List of users retrieved successfully.', type: [UserResponseDto] }) // Use DTO for response type
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Requires ADMIN role.' })
  async findAll(): Promise<UserResponseDto[]> {
    this.logger.log('Request received for finding all users');
    const users = await this.usersService.findAll(); // Assuming findAll exists in service
    // Map to DTO to exclude sensitive fields if necessary
    return users.map(user => new UserResponseDto(user));
  }

  /**
   * Retrieves details for a specific user by their ID.
   * Requires ADMIN role.
   * @param {string} id - The UUID of the user to retrieve.
   * @returns {Promise<UserResponseDto>} The user details.
   * @throws {NotFoundException} If the user with the specified ID is not found.
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Retrieve a specific user by ID (Admin Only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the user', type: String })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully.', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    this.logger.log(`Request received for finding user with ID: ${id}`);
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    // Map to DTO
    return new UserResponseDto(user);
  }

  /**
   * Updates the role of a specific user.
   * Requires ADMIN role.
   * @param {string} id - The UUID of the user whose role is to be updated.
   * @param {UpdateUserRoleDto} updateUserRoleDto - DTO containing the new role.
   * @returns {Promise<UserResponseDto>} The updated user details.
   * @throws {NotFoundException} If the user with the specified ID is not found.
   */
  @Put(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a user\'s role (Admin Only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the user', type: String })
  @ApiBody({ type: UpdateUserRoleDto })
  @ApiResponse({ status: 200, description: 'User role updated successfully.', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., invalid role).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Request received to update role for user ID: ${id} to ${updateUserRoleDto.role}`);
    const updatedUser = await this.usersService.updateRole(id, updateUserRoleDto.role); // Assuming updateRole exists
    return new UserResponseDto(updatedUser);
  }

  /**
   * Disables a specific user account.
   * Requires ADMIN role.
   * @param {string} id - The UUID of the user to disable.
   * @returns {Promise<UserResponseDto>} The user details with updated status (if status field exists).
   * @throws {NotFoundException} If the user is not found.
   */
  @Put(':id/disable')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK) // Often PUT returns 200 OK on success
  @ApiOperation({ summary: 'Disable a user account (Admin Only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the user', type: String })
  @ApiResponse({ status: 200, description: 'User account disabled successfully.', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async disableUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    this.logger.log(`Request received to disable user ID: ${id}`);
    const user = await this.usersService.setStatus(id, false); // Assuming setStatus(id, isActive) exists
    return new UserResponseDto(user);
  }

  /**
   * Enables (reactivates) a specific user account.
   * Requires ADMIN role.
   * @param {string} id - The UUID of the user to enable.
   * @returns {Promise<UserResponseDto>} The user details with updated status.
   * @throws {NotFoundException} If the user is not found.
   */
  @Put(':id/enable')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable (reactivate) a user account (Admin Only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the user', type: String })
  @ApiResponse({ status: 200, description: 'User account enabled successfully.', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async enableUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    this.logger.log(`Request received to enable user ID: ${id}`);
    const user = await this.usersService.setStatus(id, true); // Assuming setStatus exists
    return new UserResponseDto(user);
  }
}