/*
 * --------------------------------------------------------------------------
 * File: public-api.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module for public API endpoints.
 * Imports the UsersModule to access user-related data and services.
 * Declares the PublicApiController to handle public user-related routes.
 * --------------------------------------------------------------------------
 */
import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { UsersModule } from '../users/users.module';
import { InspectionsModule } from '../inspections/inspections.module';

@Module({
  imports: [UsersModule, InspectionsModule],
  controllers: [PublicApiController],
  providers: [PublicApiService],
})
export class PublicApiModule {}
