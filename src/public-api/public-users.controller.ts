/*
 * --------------------------------------------------------------------------
 * File: public-users.controller.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS controller for handling public user-related requests,
 * specifically for retrieving inspector users.
 * --------------------------------------------------------------------------
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('Public Users') // Tag for Swagger documentation
@Controller('public/users') // Base path for this controller
export class PublicUsersController {
  private readonly logger = new Logger(PublicUsersController.name);

  constructor(private readonly usersService: UsersService) {
    this.logger.log('PublicUsersController initialized');
  }

  /**
   * Retrieves a list of all inspector users.
   *
   * @returns A promise that resolves to an array of UserResponseDto objects.
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
