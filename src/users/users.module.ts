/**
 * @fileoverview Module definition for user-related features.
 * Imports necessary modules (like PrismaModule for database access),
 * declares the UsersController to handle routes, provides the UsersService
 * for business logic, and exports UsersService so it can be injected
 * into other modules (e.g., AuthModule).
 */

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller'; // Import the controller
import { PrismaModule } from '../prisma/prisma.module'; // Import PrismaModule

@Module({
  imports: [
    PrismaModule, // Make PrismaService available for injection into UsersService
    // Import AuthModule if guards here need it (often not needed directly)
    // forwardRef(() => AuthModule) // Use forwardRef if circular dependency exists
  ],
  controllers: [UsersController], // Register the controller
  providers: [UsersService], // Register the service
  exports: [UsersService], // Export service for other modules to use
})
export class UsersModule {}
