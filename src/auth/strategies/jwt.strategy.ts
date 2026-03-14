/*
 * --------------------------------------------------------------------------
 * File: jwt.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js JWT strategy for validating access tokens.
 * Extracts the JWT from the Authorization header, verifies its signature and expiration,
 * then uses the payload (user ID) to fetch the corresponding user from the database via UsersService.
 * Attaches the validated user object (without sensitive fields) to `request.user`.
 * --------------------------------------------------------------------------
 */

import { ExtractJwt, Strategy } from 'passport-jwt'; // Import JWT Strategy components
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, OnModuleInit, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Needed for JWT secret
import { UsersService } from '../../users/users.service'; // Needed to find user by ID
import { JwtPayload } from '../interfaces/jwt-payload.interface'; // Type definition for the decoded payload
import { User } from '@prisma/client'; // Prisma User type
import { AuthService } from '../auth.service'; // Import AuthService
import { Request } from 'express'; // Import Request type
import { TokenBlacklistedException } from '../exceptions/token-blacklisted.exception'; // Import custom exception
import { VaultConfigService } from '../../config/vault-config.service';

@Injectable()
// Define the strategy, extending PassportStrategy with the base JWT Strategy.
// The default name 'jwt' is implicitly used by JwtAuthGuard unless specified otherwise.
export class JwtStrategy
  extends PassportStrategy(Strategy, 'jwt')
  implements OnModuleInit
{
  private readonly logger = new Logger(JwtStrategy.name);

  /**
   * Injects ConfigService, VaultConfigService, UsersService, and AuthService.
   *
   * @param {ConfigService} configService - Service for accessing configuration (JWT_SECRET).
   * @param {VaultConfigService} vaultConfigService - Service for Vault-managed secrets.
   * @param {UsersService} usersService - Service for user database operations.
   * @param {AuthService} authService - Service for authentication logic, including token blacklisting.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultConfigService: VaultConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService, // Inject AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Standard extraction method
      ignoreExpiration: false, // Validate token expiration
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'placeholder-jwt-secret',
      passReqToCallback: true, // Pass the request to the validate method
    });
    this.logger.log('JWT Strategy Initialized');
  }

  /**
   * After module init, update the secret key from Vault if available.
   */
  async onModuleInit(): Promise<void> {
    try {
      const secrets = await this.vaultConfigService.getSecrets();
      const jwtSecret =
        secrets.JWT_SECRET ||
        this.configService.get<string>('JWT_SECRET');
      if (jwtSecret) {
        // Patch the internal secret used by passport-jwt
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)._secretOrKey = jwtSecret;
      }
    } catch {
      // Non-fatal — continue with env value set during construction
    }
  }

  /**
   * Validate method automatically called by Passport after successfully verifying
   * the JWT's signature and expiration.
   */
  async validate(
    req: Request, // Add req parameter
    payload: JwtPayload,
  ): Promise<Omit<User, 'password' | 'googleId'>> {
    this.logger.verbose(
      `JWT Strategy validating payload for user ID (sub): ${payload.sub}`,
    );

    // Extract the raw token from the request
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req) as string; // Assert type to string
    if (!token) {
      this.logger.warn('JWT validation failed: Token not found in request.');
      throw new UnauthorizedException('Token not provided.');
    }

    // Check if the token is blacklisted
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      this.logger.verbose(
        `Token for user ID ${payload.sub} is blacklisted (expected behavior after logout).`,
      );
      throw new TokenBlacklistedException('Token has been invalidated.');
    }

    // Find the user in the database based on the 'sub' (subject) claim from the JWT payload
    const user = await this.usersService.findById(payload.sub);

    // If no user is found with that ID, the token is invalid (user might have been deleted)
    if (!user) {
      this.logger.warn(
        `JWT validation failed: User with ID ${payload.sub} from token not found.`,
      );
      throw new UnauthorizedException('User associated with token not found.');
    }

    // Session version check: reject tokens whose sessionVersion is stale.
    const tokenSessionVersion = payload.sessionVersion ?? 0;
    const userSessionVersion = user.sessionVersion ?? 0;
    if (tokenSessionVersion !== userSessionVersion) {
      this.logger.warn(
        `JWT validation failed: sessionVersion mismatch for user ID ${payload.sub}. ` +
        `Token has v${tokenSessionVersion}, DB has v${userSessionVersion}. Token invalidated.`,
      );
      throw new UnauthorizedException(
        'Token invalidated due to a security event. Please log in again.',
      );
    }

    // If user is found, return the relevant user data (excluding sensitive info)
    this.logger.verbose(`JWT validation successful for user ID: ${user.id}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, googleId, ...result } = user; // Exclude password hash and googleId
    return result; // This becomes req.user
  }
}
