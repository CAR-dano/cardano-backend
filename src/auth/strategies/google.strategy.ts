/*
 * --------------------------------------------------------------------------
 * File: google.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js strategy for Google OAuth 2.0 authentication.
 * Handles the OAuth flow, receives the user profile from Google after successful authentication,
 * and validates/creates the user in the local database via AuthService.
 * Passes the simplified, validated user object to the Passport `done` callback.
 * --------------------------------------------------------------------------
 */

import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20'; // Google strategy components
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // For Google credentials
import { AuthService } from '../auth.service'; // For user validation/creation logic
import { User } from '@prisma/client'; // Import Role for type safety
import { VaultConfigService } from '../../config/vault-config.service';

@Injectable()
// Define the strategy, extending PassportStrategy with the base Google Strategy
// and naming it 'google'. This name is used in AuthGuard('google').
export class GoogleStrategy
  extends PassportStrategy(Strategy, 'google')
  implements OnModuleInit
{
  private readonly logger = new Logger(GoogleStrategy.name);

  /**
   * Injects ConfigService, VaultConfigService, and AuthService.
   * Google OAuth credentials are resolved from Vault at module init;
   * constructor uses ConfigService as the initial source with Vault override applied via
   * onModuleInit (strategy re-registration is handled by Passport internally).
   *
   * @param {ConfigService} configService - Service to access configuration variables.
   * @param {VaultConfigService} vaultConfigService - Service for Vault-managed secrets.
   * @param {AuthService} authService - Service containing logic to validate/create Google users.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultConfigService: VaultConfigService,
    private readonly authService: AuthService,
  ) {
    // Initialize with ConfigService values; Vault override happens in onModuleInit
    // via _setOAuthOptions which patches the underlying OAuth2 client credentials.
    super({
      clientID:
        configService.get<string>('GOOGLE_CLIENT_ID') ||
        'placeholder-client-id',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        'placeholder-client-secret',
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'], // Request email and basic profile info
    });
    this.logger.log('Google Strategy Initialized');
  }

  /**
   * After module init, re-apply credentials from Vault to override env-based values.
   * This patches the underlying passport-oauth2 client credentials in-place.
   */
  async onModuleInit(): Promise<void> {
    try {
      const secrets = await this.vaultConfigService.getSecrets();
      const clientId =
        secrets.GOOGLE_CLIENT_ID ||
        this.configService.get<string>('GOOGLE_CLIENT_ID') ||
        '';
      const clientSecret =
        secrets.GOOGLE_CLIENT_SECRET ||
        this.configService.get<string>('GOOGLE_CLIENT_SECRET') ||
        '';

      if (clientId && clientSecret) {
        // Patch the OAuth2 client credentials on the underlying strategy instance
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)._oauth2._clientId = clientId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any)._oauth2._clientSecret = clientSecret;
        this.logger.log(
          'Google Strategy credentials updated from Vault.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `Google Strategy Vault credential update failed: ${(error as Error).message}. Using env values.`,
      );
    }
  }

  /**
   * Validate method automatically called by Passport after successful authentication with Google.
   */
  async validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: Profile, // Google profile data
    done: VerifyCallback, // Passport's callback function
  ): Promise<any> {
    this.logger.verbose(
      `GoogleStrategy validating profile for: ${profile.displayName} (ID: ${profile.id})`,
    );
    try {
      const user: User = await this.authService.validateUserGoogle(profile);
      const simplifiedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      done(null, simplifiedUser);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `GoogleStrategy validation failed for profile ID ${profile.id}: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `GoogleStrategy validation failed for profile ID ${profile.id}: ${error}`,
        );
      }
      done(error, false);
    }
  }
}
