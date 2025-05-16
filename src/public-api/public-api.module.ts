/*
 * --------------------------------------------------------------------------
 * File: public-api.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for public API endpoints.
 * Imports the UsersModule to provide user-related functionality.
 * Declares the PublicUsersController to handle public user routes.
 * --------------------------------------------------------------------------
 */

import { Module } from '@nestjs/common';
import { PublicUsersController } from './public-users.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PublicUsersController],
  providers: [],
})
export class PublicApiModule {}
