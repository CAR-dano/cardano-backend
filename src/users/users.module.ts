/*
 * --------------------------------------------------------------------------
 * File: users.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing user-related features.
 * Imports necessary modules like PrismaModule for database access.
 * Declares the UsersController to handle routes.
 * Provides the UsersService for business logic.
 * Exports UsersService so it can be injected into other modules (e.g., AuthModule).
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule, // Required for RedisService injection in UsersService
    // Import AuthModule if guards here need it (often not needed directly)
    // forwardRef(() => AuthModule) // Use forwardRef if circular dependency exists
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
