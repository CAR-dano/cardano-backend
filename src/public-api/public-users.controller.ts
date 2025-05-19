/*
 * --------------------------------------------------------------------------
 * File: public-users.controller.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Controller for public user-related API endpoints.
 * Handles requests for publicly accessible user data, such as listing inspectors.
 * Utilizes the UsersService to interact with user data.
 * Provides Swagger documentation annotations for API clarity.
 * --------------------------------------------------------------------------
 */
import { Controller, Get, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Public Users') // Tag for documentation
@Controller('public/users') // Base path: /api/v1/public/users
export class PublicUsersController {
  private readonly logger = new Logger(PublicUsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.log('PublicUsersController initialized');
  }

  /**
   * Retrieves a list of all inspector users.
   *
   * @returns A promise that resolves to an array of UserResponseDto objects representing inspector users.
   */
  @Get('inspectors') // Specific endpoint for finding all inspectors
  @ApiOperation({
    summary: 'Retrieve all inspector users (Public)',
    description:
      'Fetches a list of all user accounts specifically designated as inspectors. This endpoint is publicly accessible.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of inspector users.',
    type: [UserResponseDto],
  })
  async findAllInspectors(): Promise<UserResponseDto[]> {
    this.logger.log(`Public request: findAllInspectors users`);
    const users = await this.usersService.findAllInspectors();
    return users.map((user) => new UserResponseDto(user)); // Map to safe DTO
  }
}
