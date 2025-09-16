/*
 * --------------------------------------------------------------------------
 * File: jwt-auth.guard.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Authentication guard for JWT strategy.
 * This guard uses the 'jwt' Passport strategy to protect routes.
 * It validates the JWT from the request and attaches the authenticated user
 * to the request object if successful. Throws UnauthorizedException on failure.
 * --------------------------------------------------------------------------
 */

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { AppLogger } from '../../logging/app-logger.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Use the strategy name 'jwt'
  constructor(private readonly logger: AppLogger) {
    super();
    this.logger.setContext(JwtAuthGuard.name);
  }

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
