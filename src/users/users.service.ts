/**
 * @fileoverview Service responsible for all business logic related to users,
 * including finding, creating (local & Google), updating, and managing user data
 * through PrismaService. Includes password hashing for local registration.
 */

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException, // For handling unique constraint errors
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { User, Role, Prisma } from '@prisma/client';
import { RegisterUserDto } from '../auth/dto/register-user.dto'; // Import DTO for local registration
import * as bcrypt from 'bcrypt'; // Import bcrypt for hashing

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly saltRounds = 10;

  /**
   * Injects PrismaService for database interactions.
   * @param {PrismaService} prisma - The Prisma database client service.
   */
  constructor(private prisma: PrismaService) {}

  /**
   * Finds a single user by their unique email address.
   * @param {string} email - The email address to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null; // Return null if email is empty or null
    this.logger.log(`Finding user by email: ${email}`);
    try {
      return await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() }, // Store and search emails in lowercase
      });
    } catch (error) {
      this.logger.error(
        `Error finding user by email ${email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while finding user by email.',
      );
    }
  }

  /**
   * Finds a single user by their unique username. Case-insensitive search is recommended.
   * @param {string} username - The username to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   */
  async findByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    this.logger.verbose(`Finding user by username: ${username}`);
    try {
      // Prisma's default findUnique is case-sensitive for most DBs on username unless specified otherwise
      // You might need findFirst with insensitive mode if needed
      return await this.prisma.user.findUnique({
        where: { username },
        // Alternative for case-insensitive:
        // return await this.prisma.user.findFirst({
        //     where: { username: { equals: username, mode: 'insensitive' } }
        // });
      });
    } catch (error) {
      this.logger.error(
        `Error finding user by username ${username}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while finding user by username.',
      );
    }
  }

  /**
   * Finds a single user by their unique wallet address.
   * @param {string} walletAddress - The wallet address to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    if (!walletAddress) return null;
    this.logger.verbose(`Finding user by wallet address: ${walletAddress}`);
    try {
      return await this.prisma.user.findUnique({
        where: { walletAddress },
      });
    } catch (error) {
      this.logger.error(
        `Error finding user by wallet address ${walletAddress}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while finding user by wallet address.',
      );
    }
  }

  /**
   * Finds a single user by their unique ID (UUID).
   * @param {string} id - The UUID of the user.
   * @returns {Promise<User | null>} The found user or null.
   */
  async findById(id: string): Promise<User | null> {
    if (!id) return null;
    this.logger.verbose(`Finding user by ID: ${id}`);
    try {
      return await this.prisma.user.findUnique({ where: { id } });
    } catch (error) {
      this.logger.error(
        `Error finding user by ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while finding user by ID.',
      );
    }
  }

  /**
   * Finds all users. Primarily for admin use.
   * @returns {Promise<User[]>} Array of users.
   */
  async findAll(): Promise<User[]> {
    this.logger.log('Finding all users');
    try {
      return await this.prisma.user.findMany();
    } catch (error) {
      this.logger.error(
        `Error finding all users: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while retrieving users.',
      );
    }
  }

  /**
   * Creates a new user for local email/username/password registration.
   * Hashes the password before saving.
   * Checks for existing email/username to prevent duplicates.
   *
   * @param {RegisterUserDto} registerDto - DTO containing registration data.
   * @returns {Promise<User>} The newly created user object.
   * @throws {ConflictException} If email or username already exists.
   * @throws {InternalServerErrorException} For hashing or database errors.
   */
  async createLocalUser(registerDto: RegisterUserDto): Promise<User> {
    this.logger.log(
      `Attempting to register local user with email: ${registerDto.email} and username: ${registerDto.username}`,
    );

    // 1. Check for existing email or username (case-insensitive recommended for email)
    const existingByEmail = await this.findByEmail(registerDto.email);
    if (existingByEmail) {
      this.logger.warn(
        `Registration failed: Email ${registerDto.email} already exists.`,
      );
      throw new ConflictException('Email address is already registered.');
    }
    const existingByUsername = await this.findByUsername(registerDto.username);
    if (existingByUsername) {
      this.logger.warn(
        `Registration failed: Username ${registerDto.username} already exists.`,
      );
      throw new ConflictException('Username is already taken.');
    }

    // 2. Hash the password
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(registerDto.password, this.saltRounds);
      this.logger.verbose(
        `Password hashed successfully for username: ${registerDto.username}`,
      );
    } catch (hashError) {
      this.logger.error(
        `Password hashing failed for username ${registerDto.username}: ${hashError.message}`,
        hashError.stack,
      );
      throw new InternalServerErrorException('Failed to secure password.');
    }

    // 3. Create the user in the database
    try {
      const newUser = await this.prisma.user.create({
        data: {
          email: registerDto.email.toLowerCase(), // Store email in lowercase
          username: registerDto.username,
          password: hashedPassword, // Store the HASHED password
          name: registerDto.name, // Optional name from DTO
          walletAddress: registerDto.walletAddress, // Optional wallet address
          // googleId will be null by default
          // role will default to CUSTOMER based on schema
        },
      });
      this.logger.log(
        `Successfully created local user: ${newUser.id} (${newUser.username})`,
      );
      return newUser;
    } catch (error) {
      // Catch potential race condition for unique constraints if check above somehow missed
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during user creation (email/username/wallet): ${error.meta?.target}`,
        );
        // Determine which field caused the conflict based on error.meta.target
        if ((error.meta?.target as string[])?.includes('email')) {
          throw new ConflictException('Email address is already registered.');
        }
        if ((error.meta?.target as string[])?.includes('username')) {
          throw new ConflictException('Username is already taken.');
        }
        if ((error.meta?.target as string[])?.includes('walletAddress')) {
          throw new ConflictException('Wallet address is already registered.');
        }
        throw new ConflictException('A unique identifier is already in use.'); // Generic fallback
      }
      this.logger.error(
        `Database error during local user creation for ${registerDto.username}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not register user.');
    }
  }

  /**
   * Finds or creates a user based on Google profile data.
   * Uses upsert for efficiency. Handles potential errors.
   * @param profile - Profile object from passport-google-oauth20.
   * @returns {Promise<User>} The found or created user.
   */
  async findOrCreateByGoogleProfile(profile: {
    id: string;
    emails?: { value: string; verified?: boolean }[];
    displayName?: string;
  }): Promise<User> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase(); // Ensure lowercase email
    const name = profile.displayName;

    if (!email) {
      this.logger.error('Google profile validation failed: Email missing.');
      throw new InternalServerErrorException(
        'Google profile is missing email.',
      );
    }

    this.logger.log(
      `Attempting find/create user for Google profile ID: ${googleId}, email: ${email}`,
    );
    try {
      // Upsert: Find by email. If found, update googleId. If not found, create new user.
      const user = await this.prisma.user.upsert({
        where: { email: email },
        update: {
          googleId: googleId, // Add googleId if user already exists via email/username
          // Optionally update name if provided by Google and different/missing locally
          // name: name ? name : undefined, // Example: only update if Google provides a name
        },
        create: {
          email: email,
          googleId: googleId,
          name: name || `User_${googleId.substring(0, 6)}`, // Provide a default name if missing
          // username and password will be null
          // role defaults to CUSTOMER
        },
      });
      this.logger.log(
        `Successfully found/created user ID: ${user.id} for Google profile.`,
      );
      return user;
    } catch (error) {
      this.logger.error(
        `Error during upsert for Google profile ${googleId}: ${error.message}`,
        error.stack,
      );
      // Handle potential unique constraint violation if googleId already exists for *another* email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during Google upsert: ${error.meta?.target}`,
        );
        // This likely means the googleId is already linked to a DIFFERENT email
        // Or the email provided by google is somehow linked to a different googleId
        throw new ConflictException(
          'This Google account or email is already linked to another user.',
        );
      }
      throw new InternalServerErrorException(
        'Could not process Google user profile due to database error.',
      );
    }
  }

  /**
   * Updates the role of a specific user. Requires ADMIN privileges (checked in Controller).
   * @param {string} id - The UUID of the user.
   * @param {Role} newRole - The new role to assign.
   * @returns {Promise<User>} The updated user.
   */
  async updateRole(id: string, newRole: Role): Promise<User> {
    this.logger.log(
      `Attempting to update role for user ID: ${id} to ${newRole}`,
    );
    try {
      // Use update - it implicitly checks if the user exists first
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: { role: newRole },
      });
      this.logger.log(`Successfully updated role for user ID: ${id}`);
      return updatedUser;
    } catch (error) {
      // Check if the error is because the record to update wasn't found
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`User with ID "${id}" not found for role update.`);
        throw new NotFoundException(
          `User with ID "${id}" not found for role update.`,
        );
      }
      this.logger.error(
        `Error updating role for user ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Could not update role for user ID ${id}.`,
      );
    }
  }

  /**
   * Updates the 'active' status of a user. Requires 'isActive' field in schema.
   * @param {string} id - User UUID.
   * @param {boolean} isActive - New status.
   * @returns {Promise<User>} Updated user.
   */
  async setStatus(id: string, isActive: boolean): Promise<User> {
    this.logger.log(
      `Attempting to set status for user ID: ${id} to ${isActive}`,
    );
    // IMPORTANT: Add 'isActive Boolean @default(true)' to your User model in schema.prisma
    // Then run migration and generate client before using this.
    /*
    try {
        const updatedUser = await this.prisma.user.update({
            where: { id: id },
            data: { isActive: isActive }, // Assumes 'isActive' field exists
        });
        this.logger.log(`Successfully set status for user ID: ${id}`);
        return updatedUser;
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            throw new NotFoundException(`User with ID "${id}" not found for status update.`);
        }
        this.logger.error(`Error setting status for user ID ${id}: ${error.message}`, error.stack);
        throw new InternalServerErrorException(`Could not set status for user ID ${id}.`);
    }
    */
    // Placeholder if 'isActive' not implemented
    this.logger.warn(
      "'isActive' field potentially not implemented. Skipping status update logic.",
    );
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User with ID "${id}" not found.`);
    return user;
  }

  /**
   * Links a Google account (identified by googleId) to an existing user account.
   * Checks if the googleId is already linked to another user.
   * Optionally verifies if the provided email matches the existing user's email.
   *
   * @param {string} userId - The ID of the user currently logged in who wants to link Google.
   * @param {string} googleId - The unique Google ID to link.
   * @param {string} googleEmail - The email associated with the Google account (for verification).
   * @returns {Promise<User>} The updated user record with the linked googleId.
   * @throws {NotFoundException} If the user with userId is not found.
   * @throws {ConflictException} If the googleId or googleEmail is already linked to a different user.
   * @throws {BadRequestException} If the googleEmail doesn't match the user's primary email (optional check).
   * @throws {InternalServerErrorException} For database errors.
   */
  async linkGoogleAccount(
    userId: string,
    googleId: string,
    googleEmail: string,
  ): Promise<User> {
    this.logger.log(
      `User ${userId} attempting to link Google ID: ${googleId} (Email: ${googleEmail})`,
    );

    // 1. Check if googleId is already linked to *any* user
    const existingGoogleLink = await this.prisma.user.findUnique({
      where: { googleId: googleId },
      select: { id: true }, // Only need ID to check existence
    });
    if (existingGoogleLink && existingGoogleLink.id !== userId) {
      this.logger.warn(
        `Google ID ${googleId} is already linked to a different user (${existingGoogleLink.id}).`,
      );
      throw new ConflictException(
        'This Google account is already linked to another user.',
      );
    }

    // 2. Find the user who is trying to link the account
    const userToUpdate = await this.findById(userId);
    if (!userToUpdate) {
      // Should not happen if called by a logged-in user, but check anyway
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // 3. Optional but Recommended: Verify Google email matches user's primary email
    //    (Prevents linking a Google account with a different email than the user's main one)
    if (
      userToUpdate.email &&
      userToUpdate.email.toLowerCase() !== googleEmail.toLowerCase()
    ) {
      this.logger.warn(
        `Google email (${googleEmail}) does not match user's primary email (${userToUpdate.email}) for user ${userId}.`,
      );
      // Decide whether to throw an error or allow linking anyway (potential security risk?)
      throw new BadRequestException(
        'Google account email does not match your primary email.',
      );
    }

    // 4. Check if this user *already* has this googleId linked
    if (userToUpdate.googleId === googleId) {
      this.logger.log(
        `User ${userId} already has Google ID ${googleId} linked.`,
      );
      return userToUpdate; // No update needed, return current user
    }

    // 5. Perform the update
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { googleId: googleId },
      });
      this.logger.log(
        `Successfully linked Google ID ${googleId} to user ${userId}.`,
      );
      return updatedUser;
    } catch (error) {
      // Catch potential race condition where googleId became unique just now
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation for googleId ${googleId} during linking attempt for user ${userId}.`,
        );
        throw new ConflictException(
          'This Google account is already linked to another user.',
        );
      }
      this.logger.error(
        `Database error linking Google ID ${googleId} to user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not link Google account.');
    }
  }

  /**
   * Links a Cardano wallet address to an existing user account.
   * Checks if the wallet address is already linked to another user.
   *
   * @param {string} userId - The ID of the user currently logged in.
   * @param {string} walletAddress - The Cardano wallet address to link.
   * @returns {Promise<User>} The updated user record with the linked wallet address.
   * @throws {NotFoundException} If the user with userId is not found.
   * @throws {ConflictException} If the walletAddress is already linked to a different user.
   * @throws {InternalServerErrorException} For database errors.
   */
  async linkWalletAddress(
    userId: string,
    walletAddress: string,
  ): Promise<User> {
    this.logger.log(
      `User ${userId} attempting to link Wallet Address: ${walletAddress}`,
    );

    // 1. Check if walletAddress is already linked to *any* user
    const existingWalletLink = await this.findByWalletAddress(walletAddress);
    if (existingWalletLink && existingWalletLink.id !== userId) {
      this.logger.warn(
        `Wallet address ${walletAddress} is already linked to a different user (${existingWalletLink.id}).`,
      );
      throw new ConflictException(
        'This wallet address is already linked to another user.',
      );
    }

    // 2. Find the user who is trying to link the account
    const userToUpdate = await this.findById(userId);
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // 3. Check if user already has this wallet linked
    if (userToUpdate.walletAddress === walletAddress) {
      this.logger.log(
        `User ${userId} already has Wallet Address ${walletAddress} linked.`,
      );
      return userToUpdate; // No update needed
    }

    // 4. Perform the update
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { walletAddress: walletAddress },
      });
      this.logger.log(
        `Successfully linked Wallet Address ${walletAddress} to user ${userId}.`,
      );
      return updatedUser;
    } catch (error) {
      // Catch potential race condition for unique walletAddress
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation for walletAddress ${walletAddress} during linking for user ${userId}.`,
        );
        throw new ConflictException(
          'This wallet address is already linked to another user.',
        );
      }
      this.logger.error(
        `Database error linking Wallet Address ${walletAddress} to user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not link wallet address.');
    }
  }
}
