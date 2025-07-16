/*
 * --------------------------------------------------------------------------
 * File: auth.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for handling authentication logic.
 * It validates users through various methods (Local, Google OAuth, and Wallet - placeholder)
 * and generates JWT access tokens upon successful authentication.
 * It interacts with the UsersService to manage user data and uses JwtService for token handling
 * and ConfigService for accessing environment variables.
 * --------------------------------------------------------------------------
 */

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service'; // To find users
import { ConfigService } from '@nestjs/config';
import { User, Role } from '@prisma/client'; // User type from Prisma
import { JwtPayload } from './interfaces/jwt-payload.interface'; // JWT payload structure
import { Profile } from 'passport-google-oauth20'; // Google profile type
import * as bcrypt from 'bcrypt'; // For password comparison
import { PrismaService } from '../prisma/prisma.service'; // Import PrismaService

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService, // Service to interact with user data
    private readonly jwtService: JwtService, // Service to create JWTs
    private readonly configService: ConfigService, // Service to access environment variables
    private readonly prisma: PrismaService, // Inject PrismaService
  ) {}

  /**
   * Validates a user based on local credentials (email/username and password).
   * This method is typically called by the LocalStrategy.
   *
   * @param loginIdentifier The email or username provided by the user.
   * @param pass The plain text password provided by the user.
   * @returns A promise that resolves to the user object without sensitive fields if validation succeeds, otherwise null.
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
   * This method is a placeholder and requires integration with a Cardano wallet library (e.g., MeshJS or Lucid)
   * for signature verification. It is intended to be called by a potential WalletStrategy.
   *
   * @param walletAddress The wallet address claiming ownership.
   * @param signatureData The signature and potentially the message/payload that was signed. (Currently unused placeholder)
   * @returns A promise that resolves to the user object without sensitive fields if validation succeeds and signature is valid, otherwise null.
   */
  async validateWalletUser(
    walletAddress: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    signatureData: any, // signatureData is currently unused as signature verification is not implemented.
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
   * This method uses the UsersService to find or create the user based on the Google profile information.
   * It is typically called by the GoogleStrategy.
   *
   * @param profile The user profile object received from Google.
   * @returns A promise that resolves to the found or created user entity.
   * @throws InternalServerErrorException if there is an error validating the Google profile.
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
        `Failed to validate Google profile ${profile.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Throw a generic error to the strategy
      throw new InternalServerErrorException(
        'Failed to validate Google user profile.',
      );
    }
  }

  /**
   * Generates a JWT access token for a successfully validated user.
   * This method accepts a user object and creates a JWT payload containing essential user information.
   * It signs the payload using the configured JWT secret and expiration time.
   * Although marked as async, this method currently performs synchronous operations.
   *
   * @param user The validated user object (must include id, email, and role; name and username are optional).
   * @returns A promise that resolves to an object containing the generated JWT access token.
   * @throws InternalServerErrorException if the user object is invalid or if JWT signing fails.
   */
  async login(user: {
    id: string;
    email: string | null;
    role: Role;
    name?: string | null;
    username?: string | null;
  }): Promise<{ accessToken: string; refreshToken: string }> {
    if (!user || !user.id || !user.role) {
      this.logger.error(
        'Login function called without valid user object (missing id or role).',
      );
      throw new InternalServerErrorException(
        'Invalid user data provided for token generation.',
      );
    }
    this.logger.log(`Generating JWT for user ID: ${user.id}`);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      role: user.role,
      ...(user.name && { name: user.name }),
      ...(user.username && { username: user.username }),
    };

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const expiresIn = this.configService.getOrThrow<string>(
        'JWT_EXPIRATION_TIME',
      );
      const refreshTokenSecret =
        this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
      const refreshTokenExpiresIn = this.configService.getOrThrow<string>(
        'JWT_REFRESH_EXPIRATION_TIME',
      );

      const accessToken = this.jwtService.sign(payload, { secret, expiresIn });
      const refreshToken = this.jwtService.sign(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpiresIn,
      });

      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await this.usersService.updateUser(user.id, {
        refreshToken: hashedRefreshToken,
      });

      this.logger.log(`JWT generated successfully for user ID: ${user.id}`);
      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.error(
        `Failed to sign JWT for user ID ${user.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Failed to generate access token.',
      );
    }
  }

  /**
   * Blacklists a given JWT token by storing it in the database.
   * This prevents the token from being used for future authentication requests.
   *
   * @param token The JWT string to blacklist.
   * @param expiresAt The expiration date of the token.
   */
  /**
   * Checks if a given token is present in the blacklist.
   *
   * @param token The JWT string to check.
   * @returns A promise that resolves to true if the token is blacklisted, false otherwise.
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    this.logger.verbose(`Checking if token is blacklisted.`);
    try {
      const blacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });
      return !!blacklisted; // Returns true if found, false otherwise
    } catch (error) {
      this.logger.error(
        `Error checking blacklist for token: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Decide how to handle this error. For security, it might be safer to
      // treat an error as if the token IS blacklisted to prevent accidental access.
      // Or re-throw if it's a critical DB error. For now, re-throwing.
      throw new InternalServerErrorException(
        'Failed to check token blacklist.',
      );
    }
  }

  /**
   * Blacklists a given JWT token by storing it in the database.
   * This prevents the token from being used for future authentication requests.
   *
   * @param token The JWT string to blacklist.
   * @param expiresAt The expiration date of the token.
   */
  async blacklistToken(token: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      `Blacklisting token that expires at: ${expiresAt.toISOString()}`,
    );
    try {
      await this.prisma.blacklistedToken.create({
        data: {
          token,
          expiresAt,
        },
      });
      this.logger.log('Token successfully blacklisted.');
    } catch (error) {
      this.logger.error(
        `Failed to blacklist token: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Depending on error handling strategy, you might re-throw or handle gracefully
      throw new InternalServerErrorException('Failed to blacklist token.');
    }
  }

  /**
   * Validates an inspector user based on their unique PIN.
   * This method is designed for specific scenarios like PIN-based logins on shared devices.
   * It checks if a user with the given PIN exists and has the 'INSPECTOR' role.
   *
   * @param pin The PIN provided by the inspector.
   * @returns A promise that resolves to the user object without sensitive fields if validation succeeds, otherwise null.
   */
  async validateInspector(
    pin: string,
    email: string,
  ): Promise<Omit<User, 'password' | 'googleId' | 'pin'> | null> {
    this.logger.verbose(`Attempting to validate inspector by email: ${email}`);

    // 1. Find user by email first for efficiency
    const user = await this.usersService.findByEmail(email);

    // 2. Check if user exists, is an inspector, and has a PIN
    if (!user || user.role !== Role.INSPECTOR || !user.pin) {
      this.logger.warn(
        `Inspector validation failed for email ${email}: User not found, not an inspector, or no PIN set.`,
      );
      return null;
    }

    // 3. Compare the provided PIN with the stored hash
    const isPinMatching = await bcrypt.compare(pin, user.pin);

    if (isPinMatching) {
      this.logger.log(
        `Inspector validated successfully: ${email} (ID: ${user.id})`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, googleId, pin: userPin, ...result } = user;
      return result;
    } else {
      this.logger.warn(
        `Inspector validation failed: Incorrect PIN for ${email}`,
      );
      return null;
    }
  }

  /**
   * Generates a new pair of access and refresh tokens for a user.
   * This method is used to refresh an expired access token using a valid refresh token.
   * It finds the user by their ID and then calls the main login method to issue new tokens.
   *
   * @param userId The ID of the user for whom to refresh the tokens.
   * @returns A promise that resolves to an object containing the new accessToken and refreshToken.
   * @throws UnauthorizedException if no user is found with the given ID.
   */
  async refreshTokens(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Access Denied');
    }
    // The login method already handles creating new tokens and saving the new refresh token
    return this.login(user);
  }
}
