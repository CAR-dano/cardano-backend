/*
 * --------------------------------------------------------------------------
 * File: wallet.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Custom Passport.js strategy for Cardano wallet authentication (CIP-0030).
 * Extracts walletAddress, payload, and signature fields from the request body,
 * parses the CIP-0030 DataSignature JSON, and delegates to AuthService.validateWalletUser
 * for cryptographic signature verification.
 * --------------------------------------------------------------------------
 */

import { Strategy } from 'passport-custom'; // Using passport-custom for flexibility
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthService, WalletSignatureData } from '../auth.service';
import { User } from '@prisma/client';
import { Request } from 'express'; // Import Request to access body/query

// Define an interface for the expected request body structure (matches LoginWalletDto)
interface WalletAuthRequestBody {
  walletAddress?: string;
  /** Plain-text message that was signed */
  payload?: string;
  /** JSON-serialized CIP-0030 DataSignature: '{"signature":"...","key":"..."}' */
  signature?: string;
}

@Injectable()
// Use a unique name 'wallet' for this strategy
export class WalletStrategy extends PassportStrategy(Strategy, 'wallet') {
  private readonly logger = new Logger(WalletStrategy.name);

  constructor(private authService: AuthService) {
    super(); // Call super for passport-custom
    this.logger.log('Wallet Strategy Initialized');
  }

  /**
   * Validate method for the custom wallet strategy.
   * Receives the Express request object to extract wallet address, payload, and signature data.
   * Parses the JSON-serialized CIP-0030 DataSignature from the body, then delegates
   * to AuthService.validateWalletUser for cryptographic verification.
   *
   * @param {Request} req - The incoming Express request object.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>>} The validated user object.
   * @throws {BadRequestException} If required fields are missing or signature JSON is malformed.
   * @throws {UnauthorizedException} If signature verification fails or user is not found.
   */
  async validate(req: Request): Promise<Omit<User, 'password' | 'googleId'>> {
    this.logger.verbose('WalletStrategy attempting validation...');

    const { walletAddress, payload, signature } =
      req.body as WalletAuthRequestBody;

    if (!walletAddress || !payload || !signature) {
      this.logger.warn(
        'WalletStrategy validation failed: Missing walletAddress, payload, or signature in request.',
      );
      throw new BadRequestException(
        'Missing wallet address, payload, or signature data.',
      );
    }

    // Parse the JSON-serialized CIP-0030 DataSignature
    let signatureData: WalletSignatureData;
    try {
      const parsed = JSON.parse(signature) as WalletSignatureData;
      if (!parsed.signature || !parsed.key) {
        throw new Error('Missing signature or key fields');
      }
      signatureData = parsed;
    } catch (err) {
      this.logger.warn(
        `WalletStrategy validation failed: Invalid signature JSON — ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'signature must be a valid JSON object with "signature" and "key" fields.',
      );
    }

    this.logger.verbose(`Validating wallet address: ${walletAddress}`);

    // Delegate validation (including cryptographic signature check) to AuthService
    const user = await this.authService.validateWalletUser(
      walletAddress,
      payload,
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
