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

import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { // Use the strategy name 'jwt'
  private readonly logger = new Logger(JwtAuthGuard.name);

  /*
   * Overrides the default canActivate to add logging.
   * Determines if the current request is allowed to proceed based on the 'jwt' strategy.
   *
   * @param {ExecutionContext} context - The execution context providing request details.
   * @returns {boolean | Promise<boolean> | Observable<boolean>} - Result indicating if activation is allowed.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Add logging before calling super.canActivate()
    const request = context.switchToHttp().getRequest();
    this.logger.verbose(`JWT Auth Guard activated for request: ${request.method} ${request.url}`);
    // Let the parent AuthGuard handle the core logic using the 'jwt' strategy
    return super.canActivate(context);
  }

  /*
   * Overrides the default handleRequest to customize error handling and logging.
   * This method is called after the 'jwt' strategy's validate method runs.
   *
   * @param {any} err - Any error thrown during strategy execution.
   * @param {any} user - The user object returned by the strategy's validate method (if successful).
   * @param {any} info - Additional information (e.g., error messages like 'No auth token').
   * @returns {any} - The validated user object if authentication is successful.
   * @throws {UnauthorizedException} - If authentication fails (err or no user).
   */
  handleRequest(err, user, info) {
    // You can override handleRequest for custom error handling or logging
    if (err || !user) {
      this.logger.warn(`JWT Authentication failed: ${info?.message || err?.message || 'No user object found'}`);
      throw err || new UnauthorizedException(info?.message || 'Unauthorized access');
    }
    this.logger.verbose(`JWT Authentication successful for user ID: ${user.id}`);
    return user; // User will be attached to the request (req.user)
  }
}