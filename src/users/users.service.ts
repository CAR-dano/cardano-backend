/*
 * --------------------------------------------------------------------------
 * File: users.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for managing user-related business logic.
 * Handles operations like finding, creating (local and Google), updating,
 * and deleting users. Interacts with the database via PrismaService.
 * Includes password hashing for local user registration and linking external accounts.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException, // For handling unique constraint errors
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if needed
import { User, Role, Prisma } from '@prisma/client';
import { RegisterUserDto } from '../auth/dto/register-user.dto'; // Import DTO for local registration
import * as bcrypt from 'bcrypt'; // Import bcrypt for hashing
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating unique IDs
import { CreateInspectorDto } from './dto/create-inspector.dto'; // Import CreateInspectorDto
import { UpdateInspectorDto } from './dto/update-inspector.dto';
import { UpdateUserDto } from './dto/update-user.dto'; // Import UpdateUserDto
import { CreateAdminDto } from './dto/create-admin.dto'; // Import CreateAdminDto

import { RedisService } from '../redis/redis.service'; // Import RedisService

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly saltRounds = 10;
  private readonly USER_CACHE_TTL = 3600; // 1 hour

  /**
   * Constructs the UsersService and injects the PrismaService for database interactions.
   * @param {PrismaService} prisma - The Prisma database client service.
   * @param {RedisService} redisService - Service for Redis caching.
   */
  constructor(
    private prisma: PrismaService,
    private readonly redisService: RedisService,
  ) { }

  /**
   * Normalizes an email address to a standard format.
   * This involves removing dots and sub-address extensions (e.g., '+alias')
   * from the local part of the email for providers like Gmail.
   *
   * @param {string} email - The email address to normalize.
   * @returns {string} The normalized email address.
   */
  private normalizeEmail(email: string): string {
    if (!email) return '';
    const lowercasedEmail = email.toLowerCase();
    const [localPart, domain] = lowercasedEmail.split('@');

    if (!localPart || !domain) {
      // Return the original lowercased email if it's not a valid format
      return lowercasedEmail;
    }

    // Remove sub-addressing (e.g., "+test") and dots from the local part
    const normalizedLocalPart = localPart.split('+')[0].replace(/\./g, '');

    return `${normalizedLocalPart}@${domain}`;
  }

  /**
   * Helper to invalidate user cache by ID and email
   */
  private async invalidateUserCache(id: string, email?: string) {
    if (id) await this.redisService.delete(`user:id:${id}`);
    if (email) await this.redisService.delete(`user:email:${this.normalizeEmail(email)}`);
  }

  /**
   * Finds a single user by their unique email address.
   * Uses Redis cache first.
   *
   * @param {string} email - The email address to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findByEmail(email: string): Promise<User | null> {
    if (!email) return null; // Return null if email is empty or null
    const normalizedEmail = this.normalizeEmail(email);
    const cacheKey = `user:email:${normalizedEmail}`;

    this.logger.verbose(`Finding user by normalized email: ${normalizedEmail}`);

    // 1. Try Cache
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.verbose(`User cache hit for email: ${normalizedEmail}`);
        return JSON.parse(cached);
      }
    } catch (e) { /* ignore cache error */ }

    // 2. Database Fallback
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail }, // Store and search emails in lowercase
        include: { inspectionBranchCity: true },
      });

      // 3. Set Cache
      if (user) {
        await this.redisService.set(cacheKey, JSON.stringify(user), this.USER_CACHE_TTL);
        // Also cache by ID to allow lookup by ID later
        await this.redisService.set(`user:id:${user.id}`, JSON.stringify(user), this.USER_CACHE_TTL);
      }

      return user;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding user by email ${email}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error finding user by email ${email}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Database error while finding user by email.',
      );
    }
  }

  /**
   * Finds a single user by their unique username.
   * Case-insensitive search might require a different Prisma query depending on the database.
   *
   * @param {string} username - The username to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    this.logger.verbose(`Finding user by username: ${username}`);
    try {
      // Prisma's default findUnique is case-sensitive for most DBs on username unless specified otherwise
      // You might need findFirst with insensitive mode if needed
      return await this.prisma.user.findUnique({
        where: { username },
        include: { inspectionBranchCity: true },
        // Alternative for case-insensitive:
        // return await this.prisma.user.findFirst({
        //     where: { username: { equals: username, mode: 'insensitive' } }
        // });
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding user by username ${username}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error finding user by username ${username}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Database error while finding user by username.',
      );
    }
  }

  /**
   * Finds a single user by their unique wallet address.
   *
   * @param {string} walletAddress - The wallet address to search for.
   * @returns {Promise<User | null>} The found user or null if not found.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    if (!walletAddress) return null;
    this.logger.verbose(`Finding user by wallet address: ${walletAddress}`);
    try {
      return await this.prisma.user.findUnique({
        where: { walletAddress },
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding user by wallet address ${walletAddress}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error finding user by wallet address ${walletAddress}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Database error while finding user by wallet address.',
      );
    }
  }

  /**
   * Finds a single user by their unique ID (UUID).
   * Uses Redis cache first.
   *
   * @param {string} id - The UUID of the user.
   * @returns {Promise<User | null>} The found user or null.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findById(id: string): Promise<User | null> {
    if (!id) return null;
    const cacheKey = `user:id:${id}`;
    this.logger.verbose(`Finding user by ID: ${id}`);

    // 1. Try Cache
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.verbose(`User cache hit for ID: ${id}`);
        return JSON.parse(cached);
      }
    } catch (e) { /* ignore */ }

    // 2. Database Fallback
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { inspectionBranchCity: true },
      });

      // 3. Set Cache
      if (user) {
        await this.redisService.set(cacheKey, JSON.stringify(user), this.USER_CACHE_TTL);
        // Also set email cache for consistency optimization potentially?
      }

      return user;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding user by ID ${id}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error finding user by ID ${id}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Database error while finding user by ID.',
      );
    }
  }

  /**
   * Finds all users. Primarily for admin use.
   * Not cached typically as it changes often and is admin-only.
   *
   * @returns {Promise<User[]>} Array of users.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findAll(): Promise<User[]> {
    this.logger.log('Finding all users');
    try {
      return await this.prisma.user.findMany({
        include: { inspectionBranchCity: true },
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding all users: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Unknown error finding all users: ${String(error)}`);
      }
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
    const normalizedEmail = this.normalizeEmail(registerDto.email);
    this.logger.log(
      `Attempting to register local user with normalized email: ${normalizedEmail} and username: ${registerDto.username}`,
    );

    // 1. Check for existing email or username (case-insensitive recommended for email)
    const existingByEmail = await this.findByEmail(normalizedEmail);
    if (existingByEmail) {
      this.logger.warn(
        `Registration failed: Email ${normalizedEmail} already exists.`,
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
      if (hashError instanceof Error) {
        this.logger.error(
          `Password hashing failed for username ${registerDto.username}: ${hashError.message}`,
          hashError.stack,
        );
      } else {
        this.logger.error(
          `Unknown password hashing error for username ${registerDto.username}: ${String(hashError)}`,
        );
      }
      throw new InternalServerErrorException('Failed to secure password.');
    }

    // 3. Create the user in the database
    try {
      const newUser = await this.prisma.user.create({
        data: {
          id: uuidv4(), // Generate a UUID for the new user
          email: normalizedEmail, // Store normalized email
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
          `Unique constraint violation during user creation (email/username/wallet): ${String(error.meta?.target)}`,
        );
        // Determine which field caused the conflict based on error.meta.target
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('email')
        ) {
          throw new ConflictException('Email address is already registered.');
        }
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('username')
        ) {
          throw new ConflictException('Username is already taken.');
        }
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('walletAddress')
        ) {
          throw new ConflictException('Wallet address is already registered.');
        }
        throw new ConflictException('A unique identifier is already in use.'); // Generic fallback
      }
      if (error instanceof Error) {
        this.logger.error(
          `Database error during local user creation for ${registerDto.username}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown database error during local user creation for ${registerDto.username}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException('Could not register user.');
    }
  }

  /**
   * Finds or creates a user based on Google profile data.
   * Uses upsert for efficiency. Handles potential errors.
   *
   * @param profile - Profile object from passport-google-oauth20.
   * @returns {Promise<User>} The found or created user.
   * @throws {InternalServerErrorException} If the Google profile is missing email or a database error occurs.
   * @throws {ConflictException} If the Google account or email is already linked to another user.
   */
  async findOrCreateByGoogleProfile(profile: {
    id: string;
    emails?: { value: string; verified?: boolean }[];
    displayName?: string;
  }): Promise<User> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value; // Ensure lowercase email
    const name = profile.displayName;

    if (!email) {
      this.logger.error('Google profile validation failed: Email missing.');
      throw new InternalServerErrorException(
        'Google profile is missing email.',
      );
    }

    const normalizedEmail = this.normalizeEmail(email);

    this.logger.log(
      `Attempting find/create user for Google profile ID: ${googleId}, normalized email: ${normalizedEmail}`,
    );
    try {
      // Upsert: Find by email. If found, update googleId. If not found, create new user.
      const user = await this.prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          googleId: googleId, // Add googleId if user already exists via email/username
          // Optionally update name if provided by Google and different/missing locally
          // name: name ? name : undefined, // Example: only update if Google provides a name
        },
        create: {
          id: uuidv4(), // Generate a UUID for the new user
          email: normalizedEmail,
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
      if (error instanceof Error) {
        this.logger.error(
          `Error during upsert for Google profile ${googleId}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error during upsert for Google profile ${googleId}: ${String(error)}`,
        );
      }
      // Handle potential unique constraint violation if googleId already exists for *another* email
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during Google upsert: ${String(error.meta?.target)}`,
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
   * Prevents an admin from changing their own role.
   *
   * @param {string} id - The UUID of the user to update.
   * @param {Role} newRole - The new role to assign.
   * @param {string} actingUserId - The ID of the user performing the action.
   * @returns {Promise<User>} The updated user.
   * @throws {NotFoundException} If the user with the given ID is not found.
   * @throws {BadRequestException} If a user tries to change their own role.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async updateRole(
    id: string,
    newRole: Role,
    actingUserId: string,
    actingUserRole: Role,
  ): Promise<User> {
    this.logger.log(
      `User ${actingUserId} (${actingUserRole}) attempting to update role for user ID: ${id} to ${newRole}`,
    );

    if (id === actingUserId) {
      throw new BadRequestException('An admin cannot change their own role.');
    }

    const targetUser = await this.findById(id);
    if (!targetUser) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    if (actingUserRole === Role.ADMIN && targetUser.role === Role.SUPERADMIN) {
      throw new ForbiddenException(
        'Admins cannot change the role of a superadmin.',
      );
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: { role: newRole },
      });
      this.logger.log(`Successfully updated role for user ID: ${id}`);
      return updatedUser;
    } catch (error) {
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
      this.normalizeEmail(userToUpdate.email) !==
      this.normalizeEmail(googleEmail)
    ) {
      this.logger.warn(
        `Normalized Google email (${this.normalizeEmail(googleEmail)}) does not match user's primary email (${this.normalizeEmail(userToUpdate.email)}) for user ${userId}.`,
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
          `Unique constraint violation during Google upsert: ${String(error.meta?.target)}`,
        );
        // This likely means the googleId is already linked to a DIFFERENT email
        // Or the email provided by google is somehow linked to a different googleId
        throw new ConflictException(
          'This Google account or email is already linked to another user.',
        );
      }
      if (error instanceof Error) {
        this.logger.error(
          `Database error during upsert for Google profile ${googleId}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error during upsert for Google profile ${googleId}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Could not process Google user profile due to database error.',
      );
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
      if (error instanceof Error) {
        this.logger.error(
          `Database error linking Wallet Address ${walletAddress} to user ${userId}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown database error linking Wallet Address ${walletAddress} to user ${userId}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException('Could not link wallet address.');
    }
  }

  /**
   * Creates a new user with the 'INSPECTOR' role, generating a unique PIN.
   * Checks for existing email/username/walletAddress to prevent duplicates.
   *
   * @param {CreateInspectorDto} createInspectorDto - DTO containing inspector data.
   * @returns {Promise<User & { plainPin: string }>} The newly created inspector user object with the plaintext PIN.
   * @throws {ConflictException} If email, username, or walletAddress already exists.
   * @throws {InternalServerErrorException} For database or hashing errors.
   */
  async createInspector(
    createInspectorDto: CreateInspectorDto,
  ): Promise<User & { plainPin: string }> {
    this.logger.log(
      `Attempting to create inspector user with email: ${createInspectorDto.email} and username: ${createInspectorDto.username}`,
    );

    // 1. Check for existing email, username, or walletAddress
    const existingByEmail = await this.findByEmail(createInspectorDto.email);
    if (existingByEmail) {
      this.logger.warn(
        `Inspector creation failed: Email ${createInspectorDto.email} already exists.`,
      );
      throw new ConflictException('Email address is already registered.');
    }
    const existingByUsername = await this.findByUsername(
      createInspectorDto.username,
    );
    if (existingByUsername) {
      this.logger.warn(
        `Inspector creation failed: Username ${createInspectorDto.username} already exists.`,
      );
      throw new ConflictException('Username is already taken.');
    }
    if (createInspectorDto.walletAddress) {
      const existingByWalletAddress = await this.findByWalletAddress(
        createInspectorDto.walletAddress,
      );
      if (existingByWalletAddress) {
        this.logger.warn(
          `Inspector creation failed: Wallet address ${createInspectorDto.walletAddress} already exists.`,
        );
        throw new ConflictException('Wallet address is already registered.');
      }
    }

    // 1.5 Validate inspectionBranchCityId
    const branchCity = await this.prisma.inspectionBranchCity.findUnique({
      where: { id: createInspectorDto.inspectionBranchCityId },
    });
    if (!branchCity) {
      throw new BadRequestException(
        `Inspection branch city with ID "${createInspectorDto.inspectionBranchCityId}" not found.`,
      );
    }

    // 2. Generate a unique PIN
    let plainPin: string;
    let isPinUnique = false;
    do {
      plainPin = Math.floor(100000 + Math.random() * 900000).toString();
      const existingUserWithPin = await this.findByPin(plainPin);
      if (!existingUserWithPin) {
        isPinUnique = true;
      } else {
        this.logger.warn(
          `Generated PIN ${plainPin} already exists. Retrying...`,
        );
      }
    } while (!isPinUnique);

    this.logger.log(
      `Generated unique PIN: ${plainPin} for ${createInspectorDto.username}`,
    );

    // 3. Hash the unique PIN
    let hashedPin: string;
    try {
      hashedPin = await bcrypt.hash(plainPin, this.saltRounds);
      this.logger.verbose(
        `PIN hashed successfully for username: ${createInspectorDto.username}`,
      );
    } catch (hashError) {
      if (hashError instanceof Error) {
        this.logger.error(
          `PIN hashing failed for username ${createInspectorDto.username}: ${hashError.message}`,
          hashError.stack,
        );
      } else {
        this.logger.error(
          `Unknown PIN hashing error for username ${createInspectorDto.username}: ${String(hashError)}`,
        );
      }
      throw new InternalServerErrorException('Failed to secure PIN.');
    }

    // 4. Create the user in the database with the INSPECTOR role
    try {
      const newUser = await this.prisma.user.create({
        data: {
          id: uuidv4(), // Generate a UUID for the new user
          email: createInspectorDto.email.toLowerCase(), // Store email in lowercase
          username: createInspectorDto.username,
          name: createInspectorDto.name,
          walletAddress: createInspectorDto.walletAddress,
          whatsappNumber: createInspectorDto.whatsappNumber,
          role: Role.INSPECTOR, // Set the role to INSPECTOR
          pin: hashedPin,
          inspectionBranchCityId: createInspectorDto.inspectionBranchCityId,
        },
        include: {
          inspectionBranchCity: true,
        },
      });
      this.logger.log(
        `Successfully created inspector user: ${newUser.id} (${newUser.username})`,
      );
      return { ...newUser, plainPin };
    } catch (error) {
      // Catch potential race condition for unique constraints
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during inspector creation (email/username/wallet/pin): ${String(error.meta?.target)}`,
        );
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Email address is already registered.');
        }
        if (target.includes('username')) {
          throw new ConflictException('Username is already taken.');
        }
        if (target.includes('walletAddress')) {
          throw new ConflictException('Wallet address is already registered.');
        }
        if (target.includes('pin')) {
          throw new InternalServerErrorException(
            'Failed to generate a unique PIN. Please try again.',
          );
        }
        throw new ConflictException('A unique identifier is already in use.');
      }
      if (error instanceof Error) {
        this.logger.error(
          `Database error during inspector user creation for ${createInspectorDto.username}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown database error during inspector user creation for ${createInspectorDto.username}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Could not create inspector user.',
      );
    }
  }

  /**
   * Finds all users with the 'INSPECTOR' role. Primarily for admin use.
   *
   * @returns {Promise<User[]>} Array of inspector users.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findAllInspectors(): Promise<User[]> {
    this.logger.log('Finding all inspector users');
    try {
      return await this.prisma.user.findMany({
        where: { role: Role.INSPECTOR },
        include: { inspectionBranchCity: true },
      });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error finding all inspector users: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error finding all inspector users: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Database error while retrieving inspector users.',
      );
    }
  }

  /**
   * Updates details for a specific user. Requires ADMIN privileges (checked in Controller).
   * Allows updating email, username, name, and walletAddress.
   *
   * @param {string} id - The UUID of the user.
   * @param {UpdateUserDto} updateUserDto - DTO containing update data.
   * @returns {Promise<User>} The updated user.
   * @throws {NotFoundException} If the user is not found.
   * @throws {ConflictException} If updated email, username, or walletAddress already exists.
   * @throws {InternalServerErrorException} For database errors.
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Attempting to update user ID: ${id}`);

    const data: Prisma.UserUpdateInput = {
      email: updateUserDto.email?.toLowerCase(),
      username: updateUserDto.username,
      name: updateUserDto.name,
      walletAddress: updateUserDto.walletAddress,
      refreshToken: updateUserDto.refreshToken,
    };

    if (updateUserDto.pin) {
      data.pin = await bcrypt.hash(updateUserDto.pin, this.saltRounds);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data,
      });
      this.logger.log(`Successfully updated user ID: ${id}`);
      return updatedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`User with ID "${id}" not found for update.`);
        throw new NotFoundException(
          `User with ID "${id}" not found for update.`,
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during user update for ID ${id}: ${String(error.meta?.target)}`,
        );
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('email')
        ) {
          throw new ConflictException('Email address is already registered.');
        }
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('username')
        ) {
          throw new ConflictException('Username is already taken.');
        }
        if (
          Array.isArray(error.meta?.target) &&
          error.meta?.target.includes('walletAddress')
        ) {
          throw new ConflictException('Wallet address is already registered.');
        }
        throw new ConflictException('A unique identifier is already in use.'); // Generic fallback
      }
      if (error instanceof Error) {
        this.logger.error(
          `Error updating user ID ${id}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error updating user ID ${id}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(`Could not update user ID ${id}.`);
    }
  }

  /**
   * Updates details for a specific inspector. Requires ADMIN privileges.
   * Allows updating username, email, walletAddress, and PIN.
   *
   * @param {string} id - The UUID of the inspector.
   * @param {UpdateInspectorDto} updateInspectorDto - DTO containing update data.
   * @returns {Promise<User>} The updated user.
   * @throws {NotFoundException} If the inspector is not found or user is not an inspector.
   * @throws {ConflictException} If updated email, username, or walletAddress already exists.
   * @throws {InternalServerErrorException} For database errors.
   */
  async updateInspector(
    id: string,
    updateInspectorDto: UpdateInspectorDto,
  ): Promise<User> {
    this.logger.log(`Attempting to update inspector ID: ${id}`);

    const user = await this.findById(id);
    if (!user || user.role !== Role.INSPECTOR) {
      throw new NotFoundException(
        `Inspector with ID "${id}" not found or user is not an inspector.`,
      );
    }

    const data: Prisma.UserUpdateInput = {
      name: updateInspectorDto.name,
      email: updateInspectorDto.email?.toLowerCase(),
      username: updateInspectorDto.username,
      walletAddress: updateInspectorDto.walletAddress,
      whatsappNumber: updateInspectorDto.whatsappNumber,
      isActive: updateInspectorDto.isActive,
    };

    if (updateInspectorDto.inspectionBranchCityId) {
      const branchCity = await this.prisma.inspectionBranchCity.findUnique({
        where: { id: updateInspectorDto.inspectionBranchCityId },
      });
      if (!branchCity) {
        throw new BadRequestException(
          `Inspection branch city with ID "${updateInspectorDto.inspectionBranchCityId}" not found.`,
        );
      }
      data.inspectionBranchCity = {
        connect: { id: updateInspectorDto.inspectionBranchCityId },
      };
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data,
        include: {
          inspectionBranchCity: true,
        },
      });
      this.logger.log(`Successfully updated inspector ID: ${id}`);
      return updatedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during inspector update for ID ${id}: ${String(
            error.meta?.target,
          )}`,
        );
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Email address is already registered.');
        }
        if (target.includes('username')) {
          throw new ConflictException('Username is already taken.');
        }
        if (target.includes('walletAddress')) {
          throw new ConflictException('Wallet address is already registered.');
        }
        throw new ConflictException('A unique identifier is already in use.');
      }
      if (error instanceof Error) {
        this.logger.error(
          `Error updating inspector ID ${id}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error updating inspector ID ${id}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        `Could not update inspector ID ${id}.`,
      );
    }
  }

  /**
   * Generates a new PIN for a specific inspector.
   * Requires ADMIN role.
   *
   * @param {string} id - The UUID of the inspector.
   * @returns {Promise<User & { plainPin: string }>} The updated user with the new plain text PIN.
   * @throws {NotFoundException} If the inspector is not found or user is not an inspector.
   * @throws {InternalServerErrorException} For database or hashing errors.
   */
  async generatePin(id: string): Promise<User & { plainPin: string }> {
    this.logger.log(`Attempting to generate PIN for inspector ID: ${id}`);

    const user = await this.findById(id);
    if (!user || user.role !== Role.INSPECTOR) {
      throw new NotFoundException(
        `Inspector with ID "${id}" not found or user is not an inspector.`,
      );
    }

    if (user.pin) {
      this.logger.warn(`Overwriting existing PIN for inspector ID: ${id}`);
    }

    // Generate a unique PIN
    let plainPin: string;
    let isPinUnique = false;
    do {
      plainPin = Math.floor(100000 + Math.random() * 900000).toString();
      const existingUserWithPin = await this.findByPin(plainPin);
      if (!existingUserWithPin) {
        isPinUnique = true;
      } else {
        this.logger.warn(
          `Generated PIN ${plainPin} already exists. Retrying...`,
        );
      }
    } while (!isPinUnique);

    this.logger.log(`Generated unique PIN: ${plainPin} for ${user.username}`);

    // Hash the unique PIN
    let hashedPin: string;
    try {
      hashedPin = await bcrypt.hash(plainPin, this.saltRounds);
      this.logger.verbose(
        `PIN hashed successfully for username: ${user.username}`,
      );
    } catch (hashError) {
      if (hashError instanceof Error) {
        this.logger.error(
          `PIN hashing failed for username ${user.username}: ${hashError.message}`,
          hashError.stack,
        );
      } else {
        this.logger.error(
          `Unknown PIN hashing error for username ${user.username}: ${String(hashError)}`,
        );
      }
      throw new InternalServerErrorException('Failed to secure PIN.');
    }

    // Update the user in the database with the new PIN
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: id },
        data: { pin: hashedPin },
      });
      this.logger.log(
        `Successfully generated and saved PIN for inspector: ${updatedUser.id} (${updatedUser.username})`,
      );
      return { ...updatedUser, plainPin };
    } catch (error) {
      // Catch potential race condition for unique constraints
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Unique constraint violation during PIN generation for inspector (pin): ${String(error.meta?.target)}`,
        );
        throw new InternalServerErrorException(
          'Failed to generate a unique PIN. Please try again.',
        );
      }
      if (error instanceof Error) {
        this.logger.error(
          `Database error during PIN generation for inspector ${user.username}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown database error during PIN generation for inspector ${user.username}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(
        'Could not generate PIN for inspector.',
      );
    }
  }

  /**
   * Deletes a user by their unique ID (UUID). Requires ADMIN privileges (checked in Controller).
   *
   * @param {string} id - The UUID of the user to delete.
   * @returns {Promise<void>}
   * @throws {NotFoundException} If the user is not found.
   * @throws {InternalServerErrorException} For database errors.
   */
  async deleteUser(id: string): Promise<void> {
    this.logger.log(`Attempting to delete user ID: ${id}`);
    try {
      await this.prisma.user.delete({
        where: { id: id },
      });
      this.logger.log(`Successfully deleted user ID: ${id}`);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        this.logger.warn(`User with ID "${id}" not found for deletion.`);
        throw new NotFoundException(
          `User with ID "${id}" not found for deletion.`,
        );
      }
      if (error instanceof Error) {
        this.logger.error(
          `Error deleting user ID ${id}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Unknown error deleting user ID ${id}: ${String(error)}`,
        );
      }
      throw new InternalServerErrorException(`Could not delete user ID ${id}.`);
    }
  }

  /**
   * Finds an inspector by their PIN.
   * This method fetches all inspectors and then uses bcrypt.compare to find the matching PIN.
   * Note: This approach is not performant for a large number of inspectors.
   *
   * @param {string} pin - The PIN to search for.
   * @returns {Promise<User | null>} The found inspector or null.
   */
  async findByPin(pin: string): Promise<User | null> {
    const inspectors = await this.findAllInspectors();

    for (const inspector of inspectors) {
      if (inspector.pin) {
        const isMatch = await bcrypt.compare(pin, inspector.pin);
        this.logger.log(`PIN for ${inspector.username} is a match: ${isMatch}`);
        if (isMatch) {
          this.logger.log(`Successfully found inspector with matching PIN.`);
          return inspector;
        }
      } else {
        this.logger.warn(
          `Inspector ${inspector.username} (ID: ${inspector.id}) has no PIN set.`,
        );
      }
    }

    this.logger.warn(`No inspector found with a matching PIN.`);
    return null;
  }

  /**
   * Creates a new user with the 'ADMIN' or 'SUPERADMIN' role.
   * Accessible only by SUPERADMIN.
   *
   * @param {CreateAdminDto} createAdminDto - DTO containing admin data.
   * @returns {Promise<User>} The newly created user object.
   * @throws {ConflictException} If email or username already exists.
   * @throws {InternalServerErrorException} For database or hashing errors.
   */
  async createAdminOrSuperAdmin(createAdminDto: CreateAdminDto): Promise<User> {
    this.logger.log(
      `Attempting to create admin/superadmin user with email: ${createAdminDto.email} and username: ${createAdminDto.username}`,
    );

    // 1. Check for existing email or username
    const existingByEmail = await this.findByEmail(createAdminDto.email);
    if (existingByEmail) {
      throw new ConflictException('Email address is already registered.');
    }
    const existingByUsername = await this.findByUsername(
      createAdminDto.username,
    );
    if (existingByUsername) {
      throw new ConflictException('Username is already taken.');
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(
      createAdminDto.password,
      this.saltRounds,
    );

    // 3. Create the user in the database
    try {
      const newUser = await this.prisma.user.create({
        data: {
          id: uuidv4(),
          email: createAdminDto.email.toLowerCase(),
          username: createAdminDto.username,
          password: hashedPassword,
          role: createAdminDto.role, // Assign role from DTO
        },
      });
      this.logger.log(
        `Successfully created ${createAdminDto.role} user: ${newUser.id} (${newUser.username})`,
      );
      return newUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes('email')) {
          throw new ConflictException('Email address is already registered.');
        }
        if (target.includes('username')) {
          throw new ConflictException('Username is already taken.');
        }
        throw new ConflictException('A unique identifier is already in use.');
      }
      this.logger.error(
        `Database error during admin user creation for ${createAdminDto.username}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not create admin user.');
    }
  }

  /**
   * Finds all users with the 'ADMIN' or 'SUPERADMIN' role.
   *
   * @returns {Promise<User[]>} Array of admin and superadmin users.
   * @throws {InternalServerErrorException} If a database error occurs.
   */
  async findAllAdminsAndSuperAdmins(): Promise<User[]> {
    this.logger.log('Finding all admin and superadmin users');
    try {
      return await this.prisma.user.findMany({
        where: {
          role: {
            in: [Role.ADMIN, Role.SUPERADMIN],
          },
        },
        include: { inspectionBranchCity: true },
      });
    } catch (error) {
      this.logger.error(
        `Error finding all admin/superadmin users: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Database error while retrieving admin users.',
      );
    }
  }
}
