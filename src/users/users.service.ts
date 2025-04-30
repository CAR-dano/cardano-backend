/**
 * @fileoverview Service responsible for all business logic related to users,
 * including finding, creating, updating, and managing user data through PrismaService.
 */

import { Injectable, NotFoundException, InternalServerErrorException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Assuming prisma service is in ../prisma
import { User, Role } from '@prisma/client';
import { Prisma } from '@prisma/client'; // Import Prisma for error handling type

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  /**
   * Injects PrismaService for database interactions.
   * @param {PrismaService} prisma - The Prisma database client service.
   */
  constructor(private prisma: PrismaService) { }

  /**
   * Finds a single user by their unique email address.
   * @param {string} email - The email address to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    this.logger.log(`Finding user by email: ${email}`);
    try {
      return await this.prisma.user.findUnique({ where: { email } });
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}: ${error.message}`, error.stack);
      // Let the specific Prisma error propagate if needed, or throw generic error
      throw new InternalServerErrorException('Database error while finding user by email.');
    }
  }

  /**
   * Finds a single user by their unique ID (UUID).
   * @param {string} id - The UUID of the user to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   * Note: Does not throw NotFoundException here; expects caller (Guard/Controller) to handle null.
   */
  async findById(id: string): Promise<User | null> {
    this.logger.log(`Finding user by ID: ${id}`);
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Database error while finding user by ID.');
    }
  }

  /**
   * Finds all users in the database.
   * Primarily for admin use. Consider adding pagination in a real application.
   * @returns {Promise<User[]>} An array of all user objects.
   */
  async findAll(): Promise<User[]> {
    this.logger.log('Finding all users');
    try {
      return await this.prisma.user.findMany();
    } catch (error) {
      this.logger.error(`Error finding all users: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Database error while retrieving users.');
    }
  }


  /**
   * Finds an existing user by email or creates a new one based on Google profile data.
   * Updates the googleId if an existing user is found by email.
   * @param profile - The profile object from passport-google-oauth20.
   * @returns {Promise<User>} The found or newly created user.
   * @throws {InternalServerErrorException} If email is missing or DB operation fails.
   */
  async findOrCreateByGoogleProfile(profile: {
    id: string;
    emails?: { value: string; verified?: boolean }[];
    displayName?: string;
  }): Promise<User> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;

    if (!email) {
      this.logger.error('Google profile validation failed: Email missing.');
      throw new InternalServerErrorException('Google profile is missing email.');
    }

    this.logger.log(`Attempting to find or create user for Google profile ID: ${googleId}, email: ${email}`);
    try {
      const user = await this.prisma.user.upsert({
        where: { email: email },
        update: { googleId: googleId }, // Add googleId if user exists but googleId was null
        create: {
          email: email,
          googleId: googleId,
          name: name || 'User', // Default name if not provided
          role: Role.CUSTOMER, // Default role on creation
        },
      });
      this.logger.log(`Successfully found/created user ID: ${user.id} for Google profile.`);
      return user;
    } catch (error) {
      this.logger.error(`Error during upsert for Google profile ${googleId}: ${error.message}`, error.stack);
      // Handle potential unique constraint violation on googleId if necessary
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Example: googleId might already be linked to a different email
        throw new ConflictException('Google ID is already associated with another user.');
      }
      throw new InternalServerErrorException('Could not process Google user profile due to database error.');
    }
  }

  /**
   * Updates the role of a specific user.
   * @param {string} id - The UUID of the user to update.
   * @param {Role} newRole - The new role to assign.
   * @returns {Promise<User>} The updated user object.
   * @throws {NotFoundException} If the user with the ID is not found.
   * @throws {InternalServerErrorException} If the database update fails.
   */
  async updateRole(id: string, newRole: Role): Promise<User> {
    this.logger.log(`Attempting to update role for user ID: ${id} to ${newRole}`);
    try {
      // First, check if user exists to provide a better error message
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException(`User with ID "${id}" not found for role update.`);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: { role: newRole },
      });
      this.logger.log(`Successfully updated role for user ID: ${id}`);
      return updatedUser;
    } catch (error) {
      // Re-throw NotFoundException if caught from findById or handle other errors
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error updating role for user ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Could not update role for user ID ${id}.`);
    }
  }

  /**
   * Updates the 'active' status of a user (enable/disable).
   * Assumes your User model has an `isActive: Boolean @default(true)` field.
   * If not, you'll need to adapt this (e.g., use a 'status' enum or remove this method).
   *
   * @param {string} id - The UUID of the user to update.
   * @param {boolean} isActive - The new status (true for enable, false for disable).
   * @returns {Promise<User>} The updated user object.
   * @throws {NotFoundException} If the user with the ID is not found.
   * @throws {InternalServerErrorException} If the database update fails.
   */
  async setStatus(id: string, isActive: boolean): Promise<User> {
    this.logger.log(`Attempting to set status for user ID: ${id} to ${isActive}`);
    // TODO: Add an 'isActive: Boolean @default(true)' field to your User model in schema.prisma
    // TODO: and run 'npx prisma migrate dev --name add_isactive_to_user' and 'npx prisma generate'
    // TODO: If you choose not to add this field, remove or adapt this method and its controller endpoints.

    /* Uncomment and adapt after adding 'isActive' field to schema.prisma
    try {
        const updatedUser = await this.prisma.user.update({
            where: { id: id },
            data: { isActive: isActive }, // Update the isActive field
        });
        this.logger.log(`Successfully set status for user ID: ${id}`);
        return updatedUser;
    } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
              // Error P2025: Record to update not found.
            throw new NotFoundException(`User with ID "${id}" not found for status update.`);
        }
        this.logger.error(`Error setting status for user ID ${id}: ${error.message}`, error.stack);
        throw new InternalServerErrorException(`Could not set status for user ID ${id}.`);
    }
    */
    // Placeholder implementation if isActive field doesn't exist yet:
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }
    this.logger.warn(`'isActive' field not implemented in User model. Cannot truly set status for ${id}. Returning current user.`);
    return user; // Return existing user without modification until field is added
  }

}