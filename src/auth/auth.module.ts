/*
 * --------------------------------------------------------------------------
 * File: auth.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing authentication.
 * Imports necessary modules like UsersModule (for user data access),
 * PassportModule (for strategy integration), JwtModule (for token handling),
 * and ConfigModule (for configuration).
 * Declares the AuthController to handle routes.
 * Provides the AuthService, GoogleStrategy, JwtStrategy, and JwtAuthGuard.
 * Exports services and guards needed by other modules.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { WalletStrategy } from './strategies/wallet.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { WalletAuthGuard } from './guards/wallet-auth.guard';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RedisModule } from '../redis/redis.module';
import { SecurityLoggerModule } from '../security-logger/security-logger.module';
import { VaultConfigService } from '../config/vault-config.service';

/**
 * NestJS module responsible for managing authentication.
 */
@Module({
  /**
   * Imports necessary modules for authentication functionality.
   */
  imports: [
    UsersModule, // Depends on UsersService
    PassportModule.register({ defaultStrategy: 'jwt' }), // Register Passport, default can be jwt
    JwtModule.registerAsync({
      // Configure JWT Module asynchronously — resolves JWT_SECRET from Vault or env
      imports: [ConfigModule],
      inject: [ConfigService, VaultConfigService],
      useFactory: async (
        configService: ConfigService,
        vaultConfigService: VaultConfigService,
      ) => {
        // Prefer Vault-sourced secret; fall back to ConfigService
        const secrets = await vaultConfigService.getSecrets();
        const jwtSecret =
          secrets.JWT_SECRET ||
          configService.getOrThrow<string>('JWT_SECRET');
        return {
          secret: jwtSecret,
          signOptions: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: configService.get<string>('JWT_EXPIRATION_TIME') as any,
          },
        };
      },
    }),
    ConfigModule, // Required by Strategies and JwtModule factory
    RedisModule, // Import RedisModule for caching
    SecurityLoggerModule, // Import SecurityLoggerModule for audit logging
  ],
  /**
   * Declares the controllers used in this module.
   */
  controllers: [AuthController],
  /**
   * Provides services, strategies, and guards used within this module.
   */
  providers: [
    AuthService,
    GoogleStrategy, // Register Google Strategy
    JwtStrategy, // Register JWT Strategy
    WalletStrategy, // Register Wallet Strategy
    LocalStrategy, // Register Local Strategy
    JwtRefreshStrategy, // Register JWT Refresh Strategy
    JwtAuthGuard, // Register JWT Guard as a provider so that it can be injected if necessary
    RolesGuard, // Register Roles Guard as a provider
    LocalAuthGuard, // Register Local Auth (username, email, password) Guard as a provider
    WalletAuthGuard, // Register Wallet Auth Guard as a provider
    JwtRefreshGuard, // Register JWT Refresh Guard as a provider
  ],
  /**
   * Exports services and guards to be used by other modules.
   */
  exports: [AuthService, JwtAuthGuard, RolesGuard, PassportModule, JwtModule], // Export service & guard if necessary in another module
})
export class AuthModule { }
