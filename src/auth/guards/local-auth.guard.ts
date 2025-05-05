// src/auth/guards/local-auth.guard.ts
/**
 * @fileoverview Authentication guard using the 'local' Passport strategy.
 * This guard is typically applied to the login route. It triggers the LocalStrategy
 * to validate username/password credentials provided in the request body.
 * If validation succeeds, Passport attaches the user object to request.user.
 */

import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
// Extends the built-in AuthGuard, specifying the 'local' strategy registered in LocalStrategy.
export class LocalAuthGuard extends AuthGuard('local') {
  private readonly logger = new Logger(LocalAuthGuard.name);

  /**
   * Overrides canActivate for logging purposes before strategy execution.
   * @param {ExecutionContext} context - The request execution context.
   * @returns {boolean | Promise<boolean> | Observable<boolean>} Whether activation proceeds.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.verbose(
      `Local Auth Guard activated for: ${request.method} ${request.url}`,
    );
    // Delegate credential validation to the Passport 'local' strategy
    return super.canActivate(context);
  }

  // Optional: Override handleRequest if you need custom error handling for local login failures
  // handleRequest(err, user, info, context, status) {
  //   if (err || !user) {
  //     this.logger.warn(`Local Authentication failed: ${info?.message || err?.message}`);
  //     // You might throw a specific exception type here if needed
  //     throw err || new UnauthorizedException('Incorrect email/username or password.');
  //   }
  //   return user;
  // }
}
