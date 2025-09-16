/*
 * --------------------------------------------------------------------------
 * File: wallet.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Placeholder for a custom Passport.js strategy for Cardano wallet authentication.
 * WARNING: The core signature verification logic within AuthService.validateWalletUser
 * needs to be implemented using a suitable Cardano library (MeshJS, Lucid, CSL)
 * based on the frontend's signing mechanism.
 * --------------------------------------------------------------------------
 */

import { Strategy } from 'passport-custom'; // Using passport-custom for flexibility
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '@prisma/client';
import { Request } from 'express'; // Import Request to access body/query
import { AppLogger } from '../../logging/app-logger.service';

// Define an interface for the expected request body structure
interface WalletAuthRequestBody {
  walletAddress?: string;
  signatureData?: any; // Adjust 'any' to a more specific type if known
}

@Injectable()
// Use a unique name 'wallet' for this strategy
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  private readonly logger: AppLogger;

  constructor(private authService: AuthService, logger: AppLogger) {
    super(); // Call super for passport-custom
    this.logger = logger;
    this.logger.setContext(WalletStrategy.name);
    this.logger.log(
      'Wallet Strategy Initialized (Placeholder - Verification Logic Missing!)',
    );
  }

  /**
   * Validate method for the custom wallet strategy.
   * Receives the Express request object to extract wallet address and signature data.
   * Delegates the actual signature verification and user lookup to AuthService.validateWalletUser.
   *
   * @param {Request} req - The incoming Express request object.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>>} The validated user object.
   * @throws {UnauthorizedException | BadRequestException} If validation or signature verification fails.
   */
  async validate(req: Request): Promise<Omit<User, 'password' | 'googleId'>> {
    this.logger.verbose('WalletStrategy attempting validation...');

    // --- Extract Data from Request ---
    // Adjust this based on how the frontend sends the data (body, query, headers?)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { walletAddress, signatureData } = req.body as WalletAuthRequestBody; // Example: Assuming sent in body
    // ---------------------------------

    if (!walletAddress || !signatureData) {
      this.logger.warn(
        'WalletStrategy validation failed: Missing walletAddress or signatureData in request.',
      );
      throw new BadRequestException(
        'Missing wallet address or signature data.',
      );
    }

    this.logger.verbose(`Validating wallet address: ${walletAddress}`);

    // Delegate validation (including the crucial, unimplemented signature check) to AuthService
    const user = await this.authService.validateWalletUser(
      walletAddress,
      signatureData,
    );

    if (!user) {
      this.logger.warn(
        `WalletStrategy validation failed for address: ${walletAddress}`,
      );
      throw new UnauthorizedException(
        'Invalid wallet signature or user not found.',
      );
    }

    this.logger.verbose(
      `WalletStrategy validation successful for user ID: ${user.id}`,
    );
    return user; // Return validated user
  }
}
