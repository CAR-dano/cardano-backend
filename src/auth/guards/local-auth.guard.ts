/*
 * --------------------------------------------------------------------------
 * File: local-auth.guard.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Authentication guard for local strategy.
 * This guard uses the 'local' Passport strategy for username/password authentication.
 * It's typically applied to login routes and validates credentials from the request body.
 * If successful, it attaches the user object to the request.
 * --------------------------------------------------------------------------
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { AppLogger } from '../../logging/app-logger.service';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  constructor(private readonly logger: AppLogger) {
    super();
    this.logger.setContext(LocalAuthGuard.name);
  }

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
}
