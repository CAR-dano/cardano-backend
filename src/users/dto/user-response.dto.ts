/**
 * @fileoverview Data Transfer Object (DTO) representing the public-facing user data.
 * This is used as the response type for endpoints returning user information,
 * ensuring sensitive fields like passwords or internal IDs (googleId) are excluded.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Role, User } from '@prisma/client'; // Import User type and Role enum from Prisma

export class UserResponseDto {
  /**
   * The unique identifier (UUID) for the user.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({ description: 'User unique identifier (UUID)' })
  id: string;

  /**
   * The user's email address. Can be null if user registered via methods
   * not requiring an email (like wallet login without linking).
   */
  @ApiProperty({ description: 'User email address', nullable: true })
  email: string | null; // Based on updated schema 'String?'

  /**
   * The user's username. Can be null if user registered via methods
   * not requiring a username (like Google or wallet login without linking).
   */
  @ApiProperty({ description: 'User username', nullable: true })
  username: string | null; // Based on updated schema 'String?'

  /**
   * The user's display name. Can be null if not provided during registration or by OAuth.
   */
  @ApiProperty({ description: 'User display name', nullable: true })
  name: string | null; // Based on updated schema 'String?'

  /**
   * The user's primary Cardano wallet address. Can be null if not linked.
   */
  @ApiProperty({ description: 'User Cardano wallet address', nullable: true })
  walletAddress: string | null; // Based on updated schema 'String?'

  /**
   * The user's assigned role, determining their permissions.
   */
  @ApiProperty({ enum: Role, description: 'User role' })
  role: Role; // Role is required

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
   * Constructor to map from a Prisma User entity to this DTO.
   * Explicitly selects fields to include and excludes sensitive ones.
   * @param {User} user - The Prisma User entity.
   */
  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.username = user.username;
    this.name = user.name;
    this.walletAddress = user.walletAddress;
    this.role = user.role;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    // Explicitly excluded: password, googleId
  }
}
