/*
 * --------------------------------------------------------------------------
 * File: local.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js local strategy for validating user credentials
 * (email/username and password) against the database using AuthService.
 * --------------------------------------------------------------------------
 */

import { Strategy } from 'passport-local'; // Import Local Strategy definition
import { PassportStrategy } from '@nestjs/passport'; // Base class for NestJS Passport strategies
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service'; // Service containing validation logic
import { User } from '@prisma/client'; // Import User type for return value structure
import { AppLogger } from '../../logging/app-logger.service';

@Injectable()
// Define the strategy class, extending PassportStrategy with the base Local Strategy
// and giving it the unique name 'local'. This name is used in AuthGuard('local').
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  // Initialize logger for this strategy context
  private readonly logger: AppLogger;

  /**
   * Injects AuthService to perform the actual user credential validation.
   * Configures the underlying passport-local Strategy:
   * - `usernameField: 'loginIdentifier'`: Tells passport-local to look for the user identifier
   *   in the request body field named 'loginIdentifier' (matching LoginUserDto).
   * - `passwordField: 'password'`: Tells passport-local to look for the password in the
   *   request body field named 'password' (matching LoginUserDto).
   *
   * @param {AuthService} authService - The authentication service instance.
   */
  constructor(
    private authService: AuthService,
    logger: AppLogger,
  ) {
    super({
      usernameField: 'loginIdentifier', // Corresponds to the field in LoginUserDto
      passwordField: 'password',
    });
    this.logger = logger;
    this.logger.setContext(LocalStrategy.name);
    this.logger.log('Local Strategy Initialized');
  }

  /**
   * Validate method automatically called by Passport during the 'local' authentication flow.
   * It receives the identifier and password extracted from the request body based on the options above.
   * It delegates the core validation logic (finding user, comparing hashed password)
   * to the injected `authService.validateLocalUser`.
   *
   * @param {string} loginIdentifier - The email or username submitted by the user.
   * @param {string} password - The plain text password submitted by the user.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>>} The validated user object (excluding sensitive fields like password hash and googleId). Passport attaches this to `request.user`.
   * @throws {UnauthorizedException} If `authService.validateLocalUser` returns null (indicating invalid credentials or user not found).
   */
  async validate(
    loginIdentifier: string,
    password: string,
  ): Promise<Omit<User, 'password' | 'googleId'>> {
    this.logger.verbose(
      `LocalStrategy validating identifier: ${loginIdentifier}`,
    );
    // Delegate the actual validation logic to the AuthService
    const user = await this.authService.validateLocalUser(
      loginIdentifier,
      password,
    );

    // If the service method returns null, authentication failed.
    if (!user) {
      this.logger.warn(
        `LocalStrategy validation failed for identifier: ${loginIdentifier}`,
      );
      // Throwing this exception results in a 401 Unauthorized response.
      throw new UnauthorizedException('Incorrect email/username or password.');
    }

    // If validation is successful, return the user object.
    this.logger.verbose(
      `LocalStrategy validation successful for user ID: ${user.id}`,
    );
    return user; // Passport will assign this to req.user
  }
}
