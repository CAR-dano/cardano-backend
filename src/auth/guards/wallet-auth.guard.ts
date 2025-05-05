// src/auth/guards/wallet-auth.guard.ts
/**
 * @fileoverview Placeholder Authentication guard using the 'wallet' Passport strategy.
 * Applied to routes requiring Cardano wallet signature verification.
 * WARNING: Requires WalletStrategy and underlying signature verification to be fully implemented.
 */
import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
// Extends AuthGuard, specifying the 'wallet' strategy (must match WalletStrategy name)
export class WalletAuthGuard extends AuthGuard('wallet') {
  private readonly logger = new Logger(WalletAuthGuard.name);

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

  // Optional: Override handleRequest for custom errors
  // handleRequest(err, user, info, context, status) { ... }
}
