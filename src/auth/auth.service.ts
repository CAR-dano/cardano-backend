/**
 * @fileoverview Service responsible for handling authentication logic.
 * Validates users via different methods (Google OAuth, Local Credentials, Wallet - placeholder)
 * and generates JWT access tokens upon successful validation.
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service'; // To find users
import { ConfigService } from '@nestjs/config';
import { User, Role } from '@prisma/client'; // User type from Prisma
import { JwtPayload } from './interfaces/jwt-payload.interface'; // JWT payload structure
import { Profile } from 'passport-google-oauth20'; // Google profile type
import * as bcrypt from 'bcrypt'; // For password comparison

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService, // Service to interact with user data
    private readonly jwtService: JwtService, // Service to create JWTs
    private readonly configService: ConfigService, // Service to access environment variables
  ) {}

  /**
   * Validates a user based on local credentials (email/username and password).
   * Called by the LocalStrategy.
   *
   * @param {string} loginIdentifier - The email or username provided by the user.
   * @param {string} pass - The plain text password provided by the user.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>> | null} The user object without sensitive fields if validation succeeds, otherwise null.
   */
  async validateLocalUser(
    loginIdentifier: string,
    pass: string,
  ): Promise<Omit<User, 'password' | 'googleId'> | null> {
    this.logger.verbose(
      `Attempting to validate local user: ${loginIdentifier}`,
    );

    // Determine if the identifier is likely an email or username
    // Basic check, can be improved (e.g., using a regex for email)
    let user: User | null;
    if (loginIdentifier.includes('@')) {
      user = await this.usersService.findByEmail(loginIdentifier);
      if (!user)
        this.logger.warn(
          `Local validation failed: User not found with email ${loginIdentifier}`,
        );
    } else {
      user = await this.usersService.findByUsername(loginIdentifier);
      if (!user)
        this.logger.warn(
          `Local validation failed: User not found with username ${loginIdentifier}`,
        );
    }

    // If user exists and has a password set (meaning they registered locally)
    if (user && user.password) {
      // Compare the provided password with the stored hash
      const isPasswordMatching = await bcrypt.compare(pass, user.password);
      if (isPasswordMatching) {
        this.logger.log(
          `Local user validated successfully: ${loginIdentifier} (ID: ${user.id})`,
        );
        // Return user data, excluding sensitive fields like password hash and googleId
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, googleId, ...result } = user;
        return result; // This will be passed to the login method by LocalAuthGuard/Passport
      } else {
        this.logger.warn(
          `Local validation failed: Incorrect password for ${loginIdentifier}`,
        );
      }
    } else if (user && !user.password) {
      this.logger.warn(
        `Local validation failed: User ${loginIdentifier} exists but has no password set (likely registered via OAuth/Wallet).`,
      );
      // Optional: You might want to guide the user to log in via their original method
    }

    // If user not found, or password doesn't exist, or password doesn't match
    return null; // Passport expects null if validation fails
  }

  /**
   * Validates a user based on a signed message from a Cardano wallet.
   * (Placeholder - Requires integration with a Cardano wallet library like MeshJS or Lucid)
   * Called by a potential WalletStrategy.
   *
   * @param {string} walletAddress - The wallet address claiming ownership.
   * @param {string | object} signatureData - The signature and potentially the message/payload that was signed.
   * @returns {Promise<Omit<User, 'password' | 'googleId'>> | null} User object or null.
   */
  async validateWalletUser(
    walletAddress: string,
    signatureData: any,
  ): Promise<Omit<User, 'password' | 'googleId'> | null> {
    this.logger.verbose(`Attempting to validate wallet user: ${walletAddress}`);

    // 1. Find user by wallet address
    const user = await this.usersService.findByWalletAddress(walletAddress);
    if (!user) {
      this.logger.warn(
        `Wallet validation failed: User not found with wallet address ${walletAddress}`,
      );
      // Option 1: Fail validation if user must exist
      return null;
      // Option 2: Create user on the fly (like findOrCreate) - Less common for wallet login
      // try { user = await this.usersService.createWalletUser(walletAddress); } catch { return null; }
    }

    // 2. --- IMPORTANT: Implement Signature Verification ---
    //    This part is highly dependent on the specific wallet interaction library and signing method used on the frontend.
    //    You need to:
    //    a. Define a standard message/nonce for the user to sign.
    //    b. Receive the signature and the key used for signing from the frontend (within signatureData).
    //    c. Use a library (e.g., MeshJS's Transaction signing/verification or cardano-serialization-lib)
    //       to verify that the signature is valid for the given message/nonce and corresponds to the public key
    //       derived from the provided walletAddress.
    this.logger.warn(
      `!!! Wallet signature verification logic is NOT IMPLEMENTED in validateWalletUser for ${walletAddress} !!!`,
    );
    const isSignatureValid = false; // <-- Replace with actual verification call
    // Example (Conceptual - Actual implementation depends on library):
    // const messageToVerify = "Login to CAR-dano"; // Or a unique nonce
    // isSignatureValid = verifyCardanoSignature(walletAddress, messageToVerify, signatureData.signature, signatureData.key);
    // -----------------------------------------------

    if (user && isSignatureValid) {
      // Check user exists *and* signature is valid
      this.logger.log(
        `Wallet user validated successfully: ${walletAddress} (ID: ${user.id})`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, googleId, ...result } = user;
      return result;
    } else {
      this.logger.warn(
        `Wallet validation failed for ${walletAddress}. Signature valid: ${isSignatureValid}`,
      );
      return null;
    }
  }

  /**
   * Validates a user based on the profile received from Google OAuth.
   * Uses the UsersService to find/create user.
   * Called by the GoogleStrategy.
   * @param {Profile} profile - The user profile from Google.
   * @returns {Promise<User>} The found or created user entity.
   */
  async validateUserGoogle(profile: Profile): Promise<User> {
    this.logger.log(`Attempting to validate Google profile: ${profile.id}`);
    try {
      // findOrCreate handles DB logic and potential conflicts
      const user = await this.usersService.findOrCreateByGoogleProfile({
        id: profile.id,
        emails: profile.emails,
        displayName: profile.displayName,
      });
      this.logger.log(
        `Google profile validated successfully for user ID: ${user.id}`,
      );
      return user; // Return the full user object from DB
    } catch (error) {
      // Log the specific error from findOrCreate
      this.logger.error(
        `Failed to validate Google profile ${profile.id}: ${error.message}`,
        error.stack,
      );
      // Throw a generic error to the strategy
      throw new InternalServerErrorException(
        'Failed to validate Google user profile.',
      );
    }
  }

  /**
   * Generates a JWT access token for a successfully validated user.
   * Accepts a user object (potentially partial, must include id, email, role).
   * Handles potentially null/undefined name/email/username in payload.
   *
   * @param user - The validated user object (needs id, email, role; name/username optional).
   * @returns {Promise<{ accessToken: string }>} Object containing the JWT.
   * @throws {InternalServerErrorException} If JWT signing fails.
   */
  async login(user: {
    id: string;
    email: string | null;
    role: Role;
    name?: string | null;
    username?: string | null;
  }): Promise<{ accessToken: string }> {
    if (!user || !user.id || !user.role) {
      this.logger.error(
        'Login function called without valid user object (missing id or role).',
      );
      throw new InternalServerErrorException(
        'Invalid user data provided for token generation.',
      );
    }
    this.logger.log(`Generating JWT for user ID: ${user.id}`);

    // Construct JWT payload - only include non-null/undefined optional fields
    const payload: JwtPayload = {
      sub: user.id,
      // Email might be null if user logged in via Wallet initially and didn't link email
      email: user.email ?? undefined, // Use ?? undefined to explicitly exclude null from payload if needed
      role: user.role,
      // Only include name/username if they exist
      ...(user.name && { name: user.name }),
      ...(user.username && { username: user.username }),
    };
    this.logger.verbose(
      `JWT Payload created for user ${user.id}: ${JSON.stringify(payload)}`,
    );

    try {
      // Retrieve secret and expiration from config
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const expiresIn = this.configService.getOrThrow<string>(
        'JWT_EXPIRATION_TIME',
      );

      // Sign the payload
      const accessToken = this.jwtService.sign(payload, { secret, expiresIn });

      this.logger.log(`JWT generated successfully for user ID: ${user.id}`);
      return { accessToken };
    } catch (error) {
      this.logger.error(
        `Failed to sign JWT for user ID ${user.id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to generate access token.',
      );
    }
  }

  // Optional: Server-side logout logic (e.g., token blacklisting) could go here
  // async logout(token: string): Promise<void> { ... }
}
