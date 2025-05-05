/**
 * @fileoverview Implements the Passport.js strategy for Google OAuth 2.0 authentication.
 * Handles the OAuth flow, receives the user profile from Google after successful authentication,
 * and validates/creates the user in the local database via AuthService.
 * Passes the simplified, validated user object to the Passport `done` callback.
 */

import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20'; // Google strategy components
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // For Google credentials
import { AuthService } from '../auth.service'; // For user validation/creation logic
import { User, Role } from '@prisma/client'; // Import Role for type safety

@Injectable()
// Define the strategy, extending PassportStrategy with the base Google Strategy
// and naming it 'google'. This name is used in AuthGuard('google').
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  /**
   * Injects ConfigService for Google API credentials and AuthService for user processing.
   * Configures the Google OAuth 2.0 client:
   * - `clientID`, `clientSecret`: Credentials obtained from Google Cloud Console.
   * - `callbackURL`: The URL in this backend application that Google redirects back to after authentication.
   * - `scope`: The user information requested from Google (email and profile).
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
      scope: ['email', 'profile'], // Request email and basic profile info
    });
    this.logger.log('Google Strategy Initialized');
  }

  /**
   * Validate method automatically called by Passport after successful authentication with Google.
   * Receives the Google access token, refresh token (optional), and the user's Google profile.
   * It delegates the actual user lookup/creation to `authService.validateUserGoogle`.
   * Finally, it calls the `done` callback provided by Passport.
   *
   * @param {string} accessToken - Google access token (can be used to call Google APIs, often not needed here).
   * @param {string | undefined} refreshToken - Google refresh token (if configured and granted).
   * @param {Profile} profile - User profile information provided by Google (ID, name, emails, etc.).
   * @param {VerifyCallback} done - Passport callback function `(error: any, user?: Express.User | false, info?: object) => void`.
   *        - Call `done(null, user)` on success, passing the validated user object.
   *        - Call `done(error, false)` on failure.
   * @returns {Promise<any>} - The promise resolves when the `done` callback is invoked.
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
      // Delegate the core logic of finding or creating the user based on the Google profile
      // to the AuthService. This keeps the strategy focused on the OAuth flow itself.
      const user: User = await this.authService.validateUserGoogle(profile);

      // If user validation/creation is successful, prepare the user object
      // to be passed to the 'done' callback. This object will become `req.user`
      // in the subsequent request handler (e.g., the googleAuthRedirect controller method).
      // Only include necessary fields for the next step (usually login/JWT generation).
      const simplifiedUser = {
        id: user.id,
        email: user.email, // Email is crucial, ensure it's present
        name: user.name,
        role: user.role, // Role is important for authorization
      };

      // Call the 'done' callback with null error and the simplified user object.
      done(null, simplifiedUser);
    } catch (error) {
      // If any error occurs during user validation/creation in AuthService
      this.logger.error(
        `GoogleStrategy validation failed for profile ID ${profile.id}: ${error.message}`,
        error.stack,
      );
      // Call the 'done' callback with the error object and 'false' to indicate failure.
      done(error, false);
    }
  }
}
