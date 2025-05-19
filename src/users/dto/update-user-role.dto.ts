/*
 * --------------------------------------------------------------------------
 * File: update-user-role.dto.ts
 * Project: cardano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) for updating a user's role by an administrator.
 * Defines the required field for updating a user's role.
 * --------------------------------------------------------------------------
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

/**
 * DTO for updating a user's role.
 */
export class UpdateUserRoleDto {
  /**
   * The new role to assign to the user. Must be a valid value from the Role enum.
   * This field is required for the update operation.
   * @example Role.ADMIN
   */
  @ApiProperty({
    enum: Role,
    description: 'The new role to assign to the user',
    example: Role.ADMIN,
    required: true,
  })
  @IsEnum(Role, {
    message: 'Role must be a valid role value (ADMIN, REVIEWER, etc.)',
  })
  @IsNotEmpty({ message: 'Role cannot be empty' })
  role: Role;
}
