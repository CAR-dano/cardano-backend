/*
 * --------------------------------------------------------------------------
 * File: jwt-auth.guard.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: An authentication guard that leverages the 'jwt' Passport strategy.
 * It automatically extracts and validates the JWT from incoming requests for
 * endpoints where it's applied using `@UseGuards(JwtAuthGuard)`.
 * If validation succeeds, the request is allowed to proceed, and the user object
 * returned by the JwtStrategy's validate method is attached to `request.user`.
 * If validation fails, it throws an UnauthorizedException by default.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Use the strategy name 'jwt'
  private readonly logger = new Logger(JwtAuthGuard.name);

  /**
   * Overrides canActivate to provide more detailed logging before strategy execution.
   * @param {ExecutionContext} context - The request execution context.
   * @returns {boolean | Promise<boolean> | Observable<boolean>} Whether access is granted.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.verbose(
      `JWT Auth Guard activated for: ${request.method} ${request.url}`,
    );
    // Delegate the actual JWT validation to the Passport 'jwt' strategy via super.canActivate()
    return super.canActivate(context);
  }

  /**
   * Overrides handleRequest to customize error handling and logging after strategy validation.
   * @param {any} err - Error thrown by the Passport strategy or during validation.
   * @param {any} user - The user object returned by JwtStrategy.validate() on success.
   * @param {any} info - Additional info, often contains specific error details (e.g., TokenExpiredError).
   * @returns {any} The validated user object.
   * @throws {UnauthorizedException} If authentication fails.
   */
  handleRequest(
    err,
    user,
    info: Error,
    context: ExecutionContext,
    status?: any,
  ) {
    const request = context.switchToHttp().getRequest();
    const logCtx = `${request.method} ${request.originalUrl}`; // Context for logs

    // Log detailed errors if available
    if (info instanceof TokenExpiredError) {
      this.logger.warn(`[${logCtx}] JWT Token Expired: ${info.message}`);
      throw new UnauthorizedException('Token has expired');
    }
    if (info instanceof JsonWebTokenError) {
      this.logger.warn(`[${logCtx}] Invalid JWT Token: ${info.message}`);
      throw new UnauthorizedException('Invalid token');
    }
    if (err) {
      this.logger.error(
        `[${logCtx}] Unknown error during JWT validation: ${err.message}`,
        err.stack,
      );
      throw err || new UnauthorizedException('Authentication error');
    }
    if (!user) {
      // This case might happen if validate returns null/false or other strategy issues
      this.logger.warn(
        `[${logCtx}] JWT validation failed: No user object returned from strategy. Info: ${info?.message}`,
      );
      throw new UnauthorizedException('Unauthorized access');
    }

    // If everything is fine, log success and return the user
    this.logger.verbose(
      `[${logCtx}] JWT Authentication successful for user ID: ${user.id}`,
    );
    return user; // Attach user to request.user
  }
}
