/*
 * --------------------------------------------------------------------------
 * File: wallet-auth.guard.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Authentication guard for wallet strategy.
 * This guard uses the 'wallet' Passport strategy for Cardano wallet signature verification.
 * It's applied to routes requiring wallet authentication.
 * NOTE: Requires WalletStrategy and underlying signature verification to be fully implemented.
 * --------------------------------------------------------------------------
 */
import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class WalletAuthGuard extends AuthGuard('wallet') {
  private readonly logger = new Logger(WalletAuthGuard.name);

  /**
   * Determines if the request can be activated by the wallet authentication strategy.
   * Logs the activation and delegates to the Passport 'wallet' strategy.
   *
   * @param {ExecutionContext} context - The request execution context.
   * @returns {boolean | Promise<boolean> | Observable<boolean>} Whether activation proceeds.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.verbose(
      `Wallet Auth Guard activated for: ${request.method} ${request.url}`,
    );
    // Delegate to the Passport 'wallet' strategy (WalletStrategy.validate)
    return super.canActivate(context);
  }
}
