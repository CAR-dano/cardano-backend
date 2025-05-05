/*
 * --------------------------------------------------------------------------
 * File: auth.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Service responsible for handling authentication logic.
 * This includes validating users from external providers (like Google),
 * generating JWT access tokens upon successful login/validation, and potentially
 * handling other auth-related tasks like password hashing/verification if needed.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { User, Role } from '@prisma/client';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Profile } from 'passport-google-oauth20';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /*
   * Constructor for AuthService.
   * Injects necessary services: UsersService, JwtService, ConfigService.
   *
   * @param {UsersService} usersService - Service for user data operations.
   * @param {JwtService} jwtService - Service for JWT creation and verification.
   * @param {ConfigService} configService - Service for accessing environment variables.
   */
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /*
   * Validates a user based on the profile received from Google OAuth.
   * Uses the UsersService to find an existing user by email or create a new one.
   * Associates the Google ID with the user account.
   *
   * @param {Profile} profile - The user profile from Google.
   * @returns {Promise<User>} - The found or created user entity.
   * @throws {InternalServerErrorException} - If validation fails.
   */
  async validateUserGoogle(profile: Profile): Promise<User> {
    this.logger.log(`Attempting to validate Google profile: ${profile.id}`);
    try {
      const user = await this.usersService.findOrCreateByGoogleProfile({
        id: profile.id,
        emails: profile.emails,
        displayName: profile.displayName,
      });
      this.logger.log(
        `Google profile validated successfully for user ID: ${user.id}`,
      );
      return user;
    } catch (error) {
      this.logger.error(
        `Failed to validate Google profile ${profile.id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to validate Google user profile.',
      );
    }
  }

  /*
   * Generates a JWT access token for a validated user.
   * This method is called after successful authentication (e.g., via Google callback).
   *
   * @param user - The user object (or relevant parts) for whom to generate the token.
   * @returns {Promise<{ accessToken: string }>} - An object containing the generated JWT.
   * @throws {InternalServerErrorException} - If JWT signing fails.
   */
  async login(user: {
    id: string;
    email: string;
    role: Role;
    name?: string;
  }): Promise<{ accessToken: string }> {
    this.logger.log(`Generating JWT for user ID: ${user.id}`);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name, // Include name if applicable
    };

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const expiresIn = this.configService.getOrThrow<string>(
        'JWT_EXPIRATION_TIME',
      );

      const accessToken = this.jwtService.sign(payload, { secret, expiresIn });

      this.logger.log(`JWT generated successfully for user ID: ${user.id}`);
      return {
        accessToken,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sign JWT for user ID ${user.id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to generate access token.',
      );
    }
  }

  // Server-side logout function (e.g. blacklist token), add it here.
  // async logout(token: string): Promise<void> { ... }
}
