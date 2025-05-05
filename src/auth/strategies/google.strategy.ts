/*
 * --------------------------------------------------------------------------
 * File: google.strategy.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Implements the Passport.js strategy for Google OAuth 2.0 authentication.
 * This strategy handles the OAuth flow: redirecting to Google, receiving the callback
 * with the user's profile after successful Google authentication, and then validating
 * or creating the user in the local database via AuthService.
 * The validated user object (simplified) is passed to the `done` callback.
 * --------------------------------------------------------------------------
 */

import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { User } from '@prisma/client';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  /*
   * Constructor for GoogleStrategy.
   * Injects ConfigService for Google credentials and AuthService for user validation/creation.
   * Configures the Google OAuth 2.0 client ID, secret, callback URL, and requested scopes.
   *
   * @param {ConfigService} configService - Service to access configuration variables.
   * @param {AuthService} authService - Service containing logic to validate/create Google users.
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
    this.logger.log('Google Strategy Initialized');
  }

  /*
   * Validate method called by Passport after successful Google authentication and callback.
   * Receives the Google access token, refresh token (optional), and user profile.
   * Delegates the user validation/creation logic to AuthService.validateUserGoogle.
   * Calls the `done` callback with either an error or the simplified user object.
   *
   * @param {string} accessToken - Google access token (usually not needed directly here).
   * @param {string | undefined} refreshToken - Google refresh token (availability depends on Google settings).
   * @param {Profile} profile - User profile information provided by Google.
   * @param {VerifyCallback} done - Passport callback function to signal completion (err, user, info).
   * @returns {Promise<any>} - Resolves when done is called.
   */
  async validate(
    accessToken: string,
    refreshToken: string | undefined, // refreshToken may not always be present
    profile: Profile, // Profile type of passport-google-oauth20
    done: VerifyCallback,
  ): Promise<any> {
    this.logger.verbose(
      `Validating Google profile for: ${profile.displayName} (${profile.id})`,
    );
    try {
      // Delegate user validation/creation to AuthService
      const user: User = await this.authService.validateUserGoogle(profile);

      // Prepare user data to be sent to done() -> becomes req.user
      // Only send relevant data
      const simplifiedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      done(null, simplifiedUser); // Pass the simplified user object to Passport
    } catch (error) {
      this.logger.error(
        `Google validation failed for profile ID ${profile.id}: ${error.message}`,
        error.stack,
      );
      done(error, false); // Signal an error to Passport
    }
  }
}
