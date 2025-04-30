/**
 * @fileoverview Data Transfer Object for updating a user's role.
 * Contains validation rules using class-validator and API documentation
 * properties using @nestjs/swagger.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client'; // Assuming Role enum is from Prisma

export class UpdateUserRoleDto {
  /**
   * The new role to assign to the user. Must be a valid value from the Role enum.
   * @example Role.ADMIN
   */
  @ApiProperty({
    enum: Role, // Tells Swagger/Scalar this is an enum
    description: 'The new role to assign to the user',
    example: Role.ADMIN, // Provides an example value in the documentation
  })
  @IsEnum(Role) // Validates that the value is one of the allowed enum values
  @IsNotEmpty() // Ensures the role is provided
  role: Role;
}