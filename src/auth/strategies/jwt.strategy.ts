/**
 * @fileoverview Implements the Passport.js JWT strategy for validating access tokens.
 * Extracts the JWT from the Authorization header, verifies its signature and expiration,
 * then uses the payload (user ID) to fetch the corresponding user from the database via UsersService.
 * Attaches the validated user object (without sensitive fields) to `request.user`.
 */

import { ExtractJwt, Strategy } from 'passport-jwt'; // Import JWT Strategy components
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Needed for JWT secret
import { UsersService } from '../../users/users.service'; // Needed to find user by ID
import { JwtPayload } from '../interfaces/jwt-payload.interface'; // Type definition for the decoded payload
import { User } from '@prisma/client'; // Prisma User type

@Injectable()
// Define the strategy, extending PassportStrategy with the base JWT Strategy.
// The default name 'jwt' is implicitly used by JwtAuthGuard unless specified otherwise.
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  /**
   * Injects ConfigService to retrieve the JWT secret and UsersService to find the user.
   * Configures the underlying passport-jwt Strategy:
   * - `jwtFromRequest`: Specifies how to extract the JWT (Bearer token from Authorization header).
   * - `ignoreExpiration: false`: Ensures expired tokens are rejected.
   * - `secretOrKey`: Provides the secret key used to sign and verify the JWT signature.
   *
   * @param {ConfigService} configService - Service for accessing configuration (JWT_SECRET).
   * @param {UsersService} usersService - Service for user database operations.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Standard extraction method
      ignoreExpiration: false, // Validate token expiration
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'), // Get secret from config
    });
    this.logger.log('JWT Strategy Initialized');
  }

  /**
   * Validate method automatically called by Passport after successfully verifying
   * the JWT's signature and expiration.
   * It receives the decoded JWT payload.
   * This method must look up the user based on the payload information (usually the user ID in 'sub')
   * and return the user object if valid, or throw an error if not.
   *
   * @param {JwtPayload} payload - The decoded payload extracted from the validated JWT.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>>} The validated user object (excluding sensitive fields). Passport attaches this to `request.user`.
   * @throws {UnauthorizedException} If the user referenced in the payload (`payload.sub`) is not found in the database.
   */
  async validate(
    payload: JwtPayload,
  ): Promise<Omit<User, 'password' | 'googleId'>> {
    this.logger.verbose(
      `JWT Strategy validating payload for user ID (sub): ${payload.sub}`,
    );
    // Find the user in the database based on the 'sub' (subject) claim from the JWT payload
    const user = await this.usersService.findById(payload.sub);

    // If no user is found with that ID, the token is invalid (user might have been deleted)
    if (!user) {
      this.logger.warn(
        `JWT validation failed: User with ID ${payload.sub} from token not found.`,
      );
      throw new UnauthorizedException('User associated with token not found.');
    }

    // If user is found, return the relevant user data (excluding sensitive info)
    this.logger.verbose(`JWT validation successful for user ID: ${user.id}`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, googleId, ...result } = user; // Exclude password hash and googleId
    return result; // This becomes req.user
  }
}
