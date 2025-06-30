/*
 * --------------------------------------------------------------------------
 * File: public-api.module.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: NestJS module responsible for managing public API endpoints.
 * This module aggregates and exposes functionalities related to public access,
 * such as user data and inspection information, without requiring authentication.
 * It imports necessary modules like UsersModule and InspectionsModule to
 * access their respective services and controllers.
 * Declares the PublicApiController to handle incoming requests for public routes.
 * Provides the PublicApiService to encapsulate business logic for these public operations.
 * --------------------------------------------------------------------------
 */

// NestJS common imports
import { Module } from '@nestjs/common';

// Local module imports
import { UsersModule } from '../users/users.module';
import { InspectionsModule } from '../inspections/inspections.module';

// Controller and service imports for this module
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';

/**
 * @module PublicApiModule
 * @description
 * NestJS module for handling public API endpoints.
 * This module integrates various functionalities to provide unauthenticated access
 * to specific parts of the application, such as user information and inspection data.
 * It serves as an entry point for external systems or clients that do not require
 * full authentication for certain operations.
 */
@Module({
  // Imports other modules that provide necessary services or controllers
  imports: [UsersModule, InspectionsModule],
  // Declares controllers that handle incoming requests for this module
  controllers: [PublicApiController],
  // Registers services that encapsulate the business logic for this module
  providers: [PublicApiService],
})
export class PublicApiModule {}
