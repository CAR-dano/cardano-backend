/*
 * --------------------------------------------------------------------------
 * File: public-api.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for public API endpoints.
 * Imports the UsersModule to access user-related data and services.
 * Declares the PublicUsersController to handle public user-related routes.
 * --------------------------------------------------------------------------
 */
import { Module } from '@nestjs/common';
import { PublicUsersController } from './public-users.controller';
import { UsersModule } from '../users/users.module';
import { InspectionsModule } from '../inspections/inspections.module';

@Module({
  imports: [UsersModule, InspectionsModule],
  controllers: [PublicUsersController],
  providers: [],
})
export class PublicApiModule {}
