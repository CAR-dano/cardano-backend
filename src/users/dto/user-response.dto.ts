/**
 * @fileoverview Data Transfer Object representing the structure of a User
 * returned by the API. Excludes sensitive information like passwords or Google IDs.
 * Uses @ApiProperty for Swagger/Scalar documentation.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client'; // Import User type and Role enum

export class UserResponseDto {
  /**
   * The unique identifier (UUID) for the user.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'User unique identifier (UUID)',
  })
  id: string;

  /**
   * The user's unique email address.
   * @example "admin@example.com"
   */
  @ApiProperty({
    example: 'admin@example.com',
    description: 'User email address',
  })
  email: string | null;

  /**
   * The user's display name. Can be null if not provided.
   * @example "Administrator"
   */
  @ApiProperty({
    example: 'Administrator',
    nullable: true,
    description: 'User display name (optional)',
  })
  name: string | null;

  /**
   * The role assigned to the user, determining their permissions.
   */
  @ApiProperty({ enum: Role, example: Role.ADMIN, description: 'User role' })
  role: Role;

  /**
   * The timestamp when the user account was created.
   */
  @ApiProperty({ description: 'Timestamp of user creation' })
  createdAt: Date;

  /**
   * The timestamp when the user account was last updated.
   */
  @ApiProperty({ description: 'Timestamp of last user update' })
  updatedAt: Date;

  /**
   * Creates a UserResponseDto from a User entity.
   * This constructor ensures that only the necessary, non-sensitive fields are included.
   * @param {User} user - The User entity from the database.
   */
  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.role = user.role;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    // Explicitly excludes googleId and any potential password hash field
  }
}
