/*
 * --------------------------------------------------------------------------
 * File: jwt.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js strategy for validating JSON Web Tokens (JWT).
 * This strategy extracts the JWT from the Authorization header, verifies its signature
 * and expiration using the secret key, and then uses the payload (specifically the user ID)
 * to fetch the user from the database, ensuring the user still exists and is valid.
 * The validated user object is attached to the `request.user`.
 * --------------------------------------------------------------------------
 */

import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  /*
   * Constructor for JwtStrategy.
   * Injects ConfigService to access JWT secret and UsersService to find users.
   * Configures the strategy to extract the JWT from the Bearer token header
   * and use the JWT_SECRET from environment variables.
   *
   * @param {ConfigService} configService - Service to access configuration variables.
   * @param {UsersService} usersService - Service to interact with user data.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
    this.logger.log('JWT Strategy Initialized');
  }

  /*
   * Validate method called by Passport after successful token verification.
   * It receives the decoded JWT payload.
   * This method should fetch the user associated with the payload's subject (ID)
   * and return the user object (or relevant parts) to be attached to `req.user`.
   * Throws UnauthorizedException if the user is not found or invalid.
   *
   * @param {JwtPayload} payload - The decoded payload from the validated JWT.
   * @returns {Promise<Omit<User, 'googleId'>>} - The validated user object (excluding sensitive fields).
   * @throws {UnauthorizedException} - If the user associated with the token is not found.
   */
  async validate(payload: JwtPayload): Promise<Omit<User, 'googleId'>> { // Return User without googleId
    this.logger.verbose(`Validating JWT payload for user ID: ${payload.sub}`);
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      this.logger.warn(`JWT validation failed: User with ID ${payload.sub} not found.`);
      throw new UnauthorizedException('Invalid token or user not found');
    }

    // Return relevant user data (without sensitive data like password hashes if any)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { googleId, ...result } = user; // Exclude googleId
    return result; // This will be req.user
  }
}