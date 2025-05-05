/**
 * @fileoverview Data Transfer Object (DTO) for updating a user's role by an administrator.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator'; // Import validators
import { Role } from '@prisma/client'; // Import Role enum from Prisma

export class UpdateUserRoleDto {
  /**
   * The new role to assign to the user. Must be a valid value from the Role enum.
   * This field is required for the update operation.
   * @example Role.ADMIN
   */
  @ApiProperty({
    enum: Role, // Helps Swagger UI generate dropdown
    description: 'The new role to assign to the user',
    example: Role.ADMIN, // Provide a valid example
    required: true, // Indicate it's required in documentation
  })
  @IsEnum(Role, {
    message: 'Role must be a valid role value (ADMIN, REVIEWER, etc.)',
  }) // Validate against enum values
  @IsNotEmpty({ message: 'Role cannot be empty' }) // Ensure a value is provided
  role: Role;
}
