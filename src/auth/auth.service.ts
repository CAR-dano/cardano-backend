/*
 * --------------------------------------------------------------------------
 * File: auth.service.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS service responsible for handling authentication logic.
 * It validates users through various methods (Local, Google OAuth, and Wallet)
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
import { RedisService } from '../redis/redis.service'; // Import RedisService
import { SecurityLoggerService } from '../security-logger/security-logger.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
} from '../security-logger/security-event.enum';
import { checkSignature } from '@meshsdk/core-cst'; // CIP-0030 signature verification

/** Shape of the CIP-0030 DataSignature provided by the frontend */
export interface WalletSignatureData {
  /** CBOR-hex encoded COSE_Sign1 signature produced by the wallet */
  signature: string;
  /** CBOR-hex encoded COSE_Key public key produced by the wallet */
  key: string;
}

/** How long (ms) a wallet login payload timestamp is considered fresh */
const WALLET_PAYLOAD_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService, // Service to interact with user data
    private readonly jwtService: JwtService, // Service to create JWTs
    private readonly configService: ConfigService, // Service to access environment variables
    private readonly prisma: PrismaService, // Inject PrismaService
    private readonly redisService: RedisService, // Inject RedisService for caching
    private readonly securityLogger: SecurityLoggerService, // Inject SecurityLoggerService
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
      if (!user) {
        this.logger.warn(
          `Local validation failed: User not found with email ${loginIdentifier}`,
        );
        void this.securityLogger.log({
          type: SecurityEventType.LOGIN_FAILURE_USER_NOT_FOUND,
          severity: SecurityEventSeverity.WARNING,
          details: { loginIdentifier },
        });
      }
    } else {
      user = await this.usersService.findByUsername(loginIdentifier);
      if (!user) {
        this.logger.warn(
          `Local validation failed: User not found with username ${loginIdentifier}`,
        );
        void this.securityLogger.log({
          type: SecurityEventType.LOGIN_FAILURE_USER_NOT_FOUND,
          severity: SecurityEventSeverity.WARNING,
          details: { loginIdentifier },
        });
      }
    }

    // If user exists and has a password set (meaning they registered locally)
    if (user && user.password) {
      // Compare the provided password with the stored hash
      const isPasswordMatching = await bcrypt.compare(pass, user.password);
      if (isPasswordMatching) {
        this.logger.log(
          `Local user validated successfully: ${loginIdentifier} (ID: ${user.id})`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, googleId, ...result } = user;
        return result; // This will be passed to the login method by LocalAuthGuard/Passport
      } else {
        this.logger.warn(
          `Local validation failed: Incorrect password for ${loginIdentifier}`,
        );
        void this.securityLogger.log({
          type: SecurityEventType.LOGIN_FAILURE_BAD_PASSWORD,
          severity: SecurityEventSeverity.WARNING,
          userId: user.id,
          details: { loginIdentifier },
        });
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
   * Validates a user based on a signed message from a Cardano wallet (CIP-0030).
   *
   * Security properties:
   * - Verifies the Ed25519 signature cryptographically using @meshsdk/core-cst checkSignature.
   * - Validates that the signing key belongs to the claimed walletAddress.
   * - Checks the signed payload contains a timestamp within WALLET_PAYLOAD_MAX_AGE_MS to
   *   prevent replay attacks (frontend must embed an ISO timestamp in the payload).
   *
   * @param walletAddress The bech32 wallet address claiming ownership.
   * @param payload The plain-text message the user signed (must include a recent ISO timestamp).
   * @param signatureData The CIP-0030 DataSignature { signature, key } hex strings.
   * @returns The user (without sensitive fields) if valid, or null.
   */
  async validateWalletUser(
    walletAddress: string,
    payload: string,
    signatureData: WalletSignatureData,
  ): Promise<Omit<User, 'password' | 'googleId'> | null> {
    this.logger.verbose(`Attempting to validate wallet user: ${walletAddress}`);

    // 1. Verify the CIP-0030 signature cryptographically.
    //    checkSignature also validates the public key matches walletAddress.
    let isSignatureValid = false;
    try {
      isSignatureValid = await checkSignature(
        payload,
        { key: signatureData.key, signature: signatureData.signature },
        walletAddress,
      );
    } catch (err) {
      this.logger.warn(
        `Wallet signature verification threw for ${walletAddress}: ${(err as Error).message}`,
      );
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      this.logger.warn(
        `Wallet validation failed: invalid signature for ${walletAddress}`,
      );
      void this.securityLogger.log({
        type: SecurityEventType.LOGIN_FAILURE_BAD_PASSWORD,
        severity: SecurityEventSeverity.WARNING,
        details: { walletAddress, reason: 'invalid_signature' },
      });
      return null;
    }

    // 2. Replay-attack protection — the frontend must embed an ISO timestamp in the payload.
    //    We extract the last ISO-8601 date-time substring and check it is recent.
    const isoMatch = payload.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/,
    );
    if (!isoMatch) {
      this.logger.warn(
        `Wallet validation failed: payload does not contain a timestamp for ${walletAddress}`,
      );
      return null;
    }
    const payloadTime = new Date(isoMatch[1]).getTime();
    if (
      isNaN(payloadTime) ||
      Date.now() - payloadTime > WALLET_PAYLOAD_MAX_AGE_MS
    ) {
      this.logger.warn(
        `Wallet validation failed: payload timestamp expired or invalid for ${walletAddress}`,
      );
      return null;
    }

    // 3. Find the user by wallet address.
    const user = await this.usersService.findByWalletAddress(walletAddress);
    if (!user) {
      this.logger.warn(
        `Wallet validation failed: User not found with wallet address ${walletAddress}`,
      );
      return null;
    }

    this.logger.log(
      `Wallet user validated successfully: ${walletAddress} (ID: ${user.id})`,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, googleId, ...result } = user;
    return result;
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
      void this.securityLogger.log({
        type: SecurityEventType.GOOGLE_LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        userId: user.id,
        details: { googleProfileId: profile.id },
      });
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
   * Generates a JWT access token pair (access + refresh) for a successfully validated user.
   * Includes the user's current sessionVersion in both tokens to support token rotation.
   *
   * @param user The validated user object (must include id, email, role, and sessionVersion).
   * @returns A promise resolving to an object with the generated accessToken and refreshToken.
   * @throws InternalServerErrorException if the user object is invalid or JWT signing fails.
   */
  async login(user: {
    id: string;
    email: string | null;
    role: Role;
    sessionVersion?: number;
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
      sessionVersion: user.sessionVersion ?? 0,
      ...(user.name && { name: user.name }),
      ...(user.username && { username: user.username }),
    };

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');

      const expiresIn = this.configService.getOrThrow<string>(
        'JWT_EXPIRATION_TIME',
      ) as any;
      const refreshTokenSecret =
        this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

      const refreshTokenExpiresIn = this.configService.getOrThrow<string>(
        'JWT_REFRESH_EXPIRATION_TIME',
      ) as any;

      const accessToken = this.jwtService.sign(payload, {
        secret,
        expiresIn: expiresIn,
      });
      const refreshToken = this.jwtService.sign(payload, {
        secret: refreshTokenSecret,
        expiresIn: refreshTokenExpiresIn,
      });

      // Hash and persist the new refresh token (system-level DB write, bypass DTO layer)
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
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
   * Checks if a given token is present in the blacklist.
   * Uses Redis cache with automatic fallback to PostgreSQL database.
   *
   * @param token The JWT string to check.
   * @returns A promise that resolves to true if the token is blacklisted, false otherwise.
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    this.logger.verbose(`Checking if token is blacklisted.`);

    try {
      // Try Redis first (fast path)
      const cachedResult = await this.redisService.get(`blacklist:${token}`);
      if (cachedResult !== null) {
        this.logger.verbose('Token blacklist check: Redis cache hit');
        return cachedResult === 'true';
      }

      // Redis miss or unavailable - fallback to database
      this.logger.verbose(
        'Token blacklist check: Redis miss, checking database',
      );
      const blacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });

      // Cache the result in Redis for next time (if Redis is available)
      if (blacklisted) {
        const ttl = Math.floor(
          (blacklisted.expiresAt.getTime() - Date.now()) / 1000,
        );
        if (ttl > 0) {
          await this.redisService
            .set(`blacklist:${token}`, 'true', ttl)
            .catch(() => {
              this.logger.warn('Failed to cache blacklist result in Redis');
            });
        }
      }

      return !!blacklisted;
    } catch (error) {
      this.logger.error(
        `Error checking blacklist: ${(error as Error).message}`,
      );

      // If Redis fails, try database as fallback
      try {
        const blacklisted = await this.prisma.blacklistedToken.findUnique({
          where: { token },
        });
        return !!blacklisted;
      } catch (dbError) {
        this.logger.error(
          `Database fallback also failed: ${(dbError as Error).message}`,
        );
        throw new InternalServerErrorException(
          'Failed to check token blacklist.',
        );
      }
    }
  }

  /**
   * Blacklists a given JWT token by storing it in both Redis and database.
   * Uses dual-write strategy for resilience and performance.
   *
   * @param token The JWT string to blacklist.
   * @param expiresAt The expiration date of the token.
   */
  async blacklistToken(token: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      `Blacklisting token that expires at: ${expiresAt.toISOString()}`,
    );

    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    try {
      // Write to both Redis and Database (dual-write for resilience)
      const results = await Promise.allSettled([
        // Write to Redis (fast, with TTL)
        this.redisService.set(`blacklist:${token}`, 'true', ttl),

        // Write to Database (persistent, for fallback)
        this.prisma.blacklistedToken.create({
          data: { token, expiresAt },
        }),
      ]);

      const [redisResult, dbResult] = results;

      if (redisResult.status === 'rejected') {
        this.logger.warn(`Redis write failed: ${redisResult.reason}`);
      }

      if (dbResult.status === 'rejected') {
        this.logger.warn(`Database write failed: ${dbResult.reason}`);
      }

      // Success if at least one write succeeded
      if (
        redisResult.status === 'fulfilled' ||
        dbResult.status === 'fulfilled'
      ) {
        this.logger.log('Token successfully blacklisted');
      } else {
        throw new Error('Both Redis and Database writes failed');
      }
    } catch (error) {
      this.logger.error(
        `Failed to blacklist token: ${(error as Error).message}`,
      );
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
      void this.securityLogger.log({
        type: SecurityEventType.INSPECTOR_LOGIN_FAILURE,
        severity: SecurityEventSeverity.WARNING,
        userId: user?.id,
        details: { email, reason: 'not_found_or_invalid_role' },
      });
      return null;
    }

    // 3. Compare the provided PIN with the stored hash
    const isPinMatching = await bcrypt.compare(pin, user.pin);

    if (isPinMatching) {
      this.logger.log(
        `Inspector validated successfully: ${email} (ID: ${user.id})`,
      );
      void this.securityLogger.log({
        type: SecurityEventType.INSPECTOR_LOGIN_SUCCESS,
        severity: SecurityEventSeverity.INFO,
        userId: user.id,
        details: { email },
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, googleId, pin: userPin, ...result } = user;
      return result;
    } else {
      this.logger.warn(
        `Inspector validation failed: Incorrect PIN for ${email}`,
      );
      void this.securityLogger.log({
        type: SecurityEventType.INSPECTOR_LOGIN_FAILURE,
        severity: SecurityEventSeverity.WARNING,
        userId: user.id,
        details: { email, reason: 'incorrect_pin' },
      });
      return null;
    }
  }

  /**
   * Rotates the token pair for a user, invalidating the previous refresh token.
   *
   * Token rotation security properties:
   * - Increments `sessionVersion` so any previously issued access tokens are immediately invalidated.
   * - Replaces the stored refresh token hash so the old refresh token cannot be reused.
   * - Returns a fresh token pair that carries the new `sessionVersion`.
   *
   * @param userId The ID of the user requesting a token refresh.
   * @returns A promise resolving to an object with the new accessToken and refreshToken.
   * @throws UnauthorizedException if no user is found with the given ID.
   */
  async refreshTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Access Denied');
    }

    // Increment session version to invalidate all previously issued access tokens for this user.
    const newSessionVersion = (user.sessionVersion ?? 0) + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: newSessionVersion },
    });
    this.logger.log(
      `Token rotated for user ID: ${userId} — sessionVersion bumped to ${newSessionVersion}`,
    );
    void this.securityLogger.log({
      type: SecurityEventType.TOKEN_ROTATED,
      severity: SecurityEventSeverity.INFO,
      userId,
      details: { newSessionVersion },
    });

    // Generate new token pair with updated sessionVersion
    return this.login({ ...user, sessionVersion: newSessionVersion });
  }

  /**
   * Revokes all active sessions for a user by incrementing their sessionVersion
   * and clearing the stored refresh token.
   *
   * This causes every outstanding access token and refresh token to fail validation,
   * effectively performing a "logout everywhere".
   *
   * @param userId The ID of the user whose sessions should be revoked.
   * @throws UnauthorizedException if no user is found with the given ID.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newSessionVersion = (user.sessionVersion ?? 0) + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        sessionVersion: newSessionVersion,
        refreshToken: null, // Clear refresh token — no refresh is possible after this
      },
    });

    this.logger.log(
      `All sessions revoked for user ID: ${userId} — sessionVersion bumped to ${newSessionVersion}`,
    );
    void this.securityLogger.log({
      type: SecurityEventType.LOGOUT_ALL_SESSIONS,
      severity: SecurityEventSeverity.CRITICAL,
      userId,
      details: { newSessionVersion },
    });
  }
}
